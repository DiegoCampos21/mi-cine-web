import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';

import { auth, googleProvider, db } from './firebase';

import {
  onAuthStateChanged,
  signInWithPopup,
  signOut
} from 'firebase/auth';

import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  deleteDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  getDocs,
  writeBatch
} from 'firebase/firestore';

// ---------------- COMPRESIÓN DE AVATARES ----------------

const compressAvatar = async file => {
  const image = await createImageBitmap(file);

  const maxDimension = 512;

  const scale = Math.min(
    1,
    maxDimension / Math.max(image.width, image.height)
  );

  const canvas = document.createElement('canvas');

  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));

  const context = canvas.getContext('2d');

  if (!context) {
    image.close();
    throw new Error('No se pudo procesar la imagen.');
  }

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.drawImage(
    image,
    0,
    0,
    canvas.width,
    canvas.height
  );

  image.close();

  let quality = 0.8;
  let result = '';

  do {
    result = canvas.toDataURL('image/jpeg', quality);
    quality -= 0.1;
  } while (
    result.length * 0.75 > 180 * 1024 &&
    quality >= 0.4
  );

  if (result.length * 0.75 > 180 * 1024) {
    throw new Error(
      'La imagen sigue siendo demasiado grande. Selecciona otra fotografía.'
    );
  }

  return result;
};

function App() {
  // ---------------- ESTADOS GENERALES ----------------

  const [activeTab, setActiveTab] = useState('catalog');
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [profiles, setProfiles] = useState([]);
  const [activeProfile, setActiveProfile] = useState(null);
  const [profileName, setProfileName] = useState('');
  const [showProfilePicker, setShowProfilePicker] = useState(false);

  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [editingProfile, setEditingProfile] = useState(null);
  const [editingProfileName, setEditingProfileName] = useState('');
  const [editingAvatar, setEditingAvatar] = useState('');
  const [editingAvatarType, setEditingAvatarType] = useState('preset');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [favorites, setFavorites] = useState([]);
  const [watchHistory, setWatchHistory] = useState([]);
  const [cloudError, setCloudError] = useState('');

  const [contentType, setContentType] = useState('movie');
  const [listType, setListType] = useState('popular');
  const [items, setItems] = useState([]);
  const [catalogRows, setCatalogRows] = useState([]);
  const [genres, setGenres] = useState([]);
  const [selectedGenre, setSelectedGenre] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemTrailer, setItemTrailer] = useState(null);
  const [isScrolled, setIsScrolled] = useState(false);

  const [heroItems, setHeroItems] = useState([]);
  const [currentHeroIndex, setCurrentHeroIndex] = useState(0);
  const [fadeAnim, setFadeAnim] = useState(true);

  const [seasons, setSeasons] = useState([]);
  const [episodes, setEpisodes] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [selectedEpisode, setSelectedEpisode] = useState(1);
  const [selectedServer, setSelectedServer] = useState('unlimplay');

  const [videoUrl, setVideoUrl] = useState('');
  const [customVideoSource, setCustomVideoSource] = useState('');

  const fileInputRef = useRef(null);
  const avatarInputRef = useRef(null);
  const movieMasterFrameRef = useRef(null);
  const movieHistoryTimerRef = useRef(null);

  const API_KEY = import.meta.env.VITE_TMDB_API_KEY;

  const avatarPresets = [
    '🎬', '🍿', '🎭', '🚀',
    '🐼', '🦊', '🦁', '🐯',
    '🐸', '🐵', '🐨', '🐧',
    '🦄', '🐲', '🌟', '🎮'
  ];

  // ---------------- TEMPORIZADOR DEL HISTORIAL ----------------

  const cancelMovieHistoryTimer = () => {
    if (movieHistoryTimerRef.current) {
      clearTimeout(movieHistoryTimerRef.current);
      movieHistoryTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => cancelMovieHistoryTimer();
  }, [user, activeProfile]);

  // ---------------- AUTENTICACIÓN ----------------

  useEffect(() => {
    return onAuthStateChanged(auth, currentUser => {
      cancelMovieHistoryTimer();

      setUser(currentUser);
      setAuthLoading(false);
      setActiveProfile(null);
      setProfiles([]);
      setFavorites([]);
      setWatchHistory([]);
      setShowAccountSettings(false);
      setShowProfilePicker(false);
      setEditingProfile(null);
    });
  }, []);

  const handleGoogleLogin = async () => {
    try {
      setCloudError('');
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      setCloudError(error.message);
    }
  };

  const handleLogout = async () => {
    cancelMovieHistoryTimer();
    setActiveProfile(null);
    setShowAccountSettings(false);
    setShowProfilePicker(false);
    setEditingProfile(null);

    try {
      await signOut(auth);
    } catch (error) {
      setCloudError(error.message);
    }
  };

  // ---------------- PERFILES ----------------

  useEffect(() => {
    if (!user) return;

    const profilesRef = collection(db, 'users', user.uid, 'profiles');

    return onSnapshot(
      profilesRef,
      async snapshot => {
        const rows = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data()
        }));

        setProfiles(rows);

        setActiveProfile(current => {
          if (!current) return null;
          return rows.find(p => p.id === current.id) || null;
        });

        if (rows.length === 0) {
          const profileRef = doc(profilesRef);

          await setDoc(profileRef, {
            name: user.displayName?.split(' ')[0] || 'Principal',
            avatar: user.photoURL || '',
            avatarType: user.photoURL ? 'google' : 'preset',
            createdAt: serverTimestamp()
          });
        }
      },
      error => setCloudError(error.message)
    );
  }, [user]);

  const createProfile = async () => {
    const name = profileName.trim();

    if (!name || !user) return;

    if (profiles.length >= 5) {
      setCloudError('Puedes crear un máximo de 5 perfiles.');
      return;
    }

    try {
      const profileRef = doc(
        collection(db, 'users', user.uid, 'profiles')
      );

      await setDoc(profileRef, {
        name,
        avatar: '🎬',
        avatarType: 'preset',
        createdAt: serverTimestamp()
      });

      setProfileName('');
      setCloudError('');
    } catch (error) {
      setCloudError(error.message);
    }
  };

  const openProfileEditor = profile => {
    setEditingProfile(profile);
    setEditingProfileName(profile.name || '');
    setEditingAvatar(profile.avatar || '');

    setEditingAvatarType(
      profile.avatarType ||
      (profile.avatar?.startsWith('http') ? 'google' : 'preset')
    );

    setCloudError('');
  };

  const closeProfileEditor = () => {
    setEditingProfile(null);
    setEditingProfileName('');
    setEditingAvatar('');
    setEditingAvatarType('preset');
  };

  // ---------------- GUARDAR CAMBIOS DEL PERFIL ----------------

  const saveProfileChanges = async () => {
    if (!user || !editingProfile) return;

    const name = editingProfileName.trim();

    if (!name) {
      setCloudError('El nombre del perfil no puede estar vacío.');
      return;
    }

    try {
      const profileRef = doc(
        db,
        'users',
        user.uid,
        'profiles',
        editingProfile.id
      );

      await updateDoc(profileRef, {
        name,
        avatar: editingAvatar,
        avatarType: editingAvatarType,
        updatedAt: serverTimestamp()
      });

      setCloudError('');
      closeProfileEditor();
    } catch (error) {
      setCloudError(error.message);
    }
  };

  const selectPresetAvatar = avatar => {
    setEditingAvatar(avatar);
    setEditingAvatarType('preset');
  };

  const useGoogleAvatar = () => {
    if (!user?.photoURL) return;

    setEditingAvatar(user.photoURL);
    setEditingAvatarType('google');
  };

  // ---------------- SUBIR FOTO PERSONALIZADA ----------------

  const handleAvatarUpload = async event => {
    const file = event.target.files?.[0];

    if (!file || !user || !editingProfile) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setCloudError('Selecciona una imagen JPG, PNG o WEBP.');
      event.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setCloudError('La imagen original no puede superar los 5 MB.');
      event.target.value = '';
      return;
    }

    setUploadingAvatar(true);
    setCloudError('');

    try {
      const compressedImage = await compressAvatar(file);

      await updateDoc(
        doc(
          db,
          'users',
          user.uid,
          'profiles',
          editingProfile.id
        ),
        {
          avatar: compressedImage,
          avatarType: 'upload',
          updatedAt: serverTimestamp()
        }
      );

      setEditingAvatar(compressedImage);
      setEditingAvatarType('upload');

      setEditingProfile(current => ({
        ...current,
        avatar: compressedImage,
        avatarType: 'upload'
      }));

    } catch (error) {
      setCloudError(
        `No se pudo guardar la imagen: ${error.message}`
      );
    } finally {
      setUploadingAvatar(false);
      event.target.value = '';
    }
  };

  // ---------------- QUITAR FOTO PERSONALIZADA ----------------

  const removeCustomAvatar = async () => {
    if (!user || !editingProfile) return;

    try {
      const fallbackAvatar = user.photoURL || '🎬';
      const fallbackType = user.photoURL ? 'google' : 'preset';

      await updateDoc(
        doc(
          db,
          'users',
          user.uid,
          'profiles',
          editingProfile.id
        ),
        {
          avatar: fallbackAvatar,
          avatarType: fallbackType,
          updatedAt: serverTimestamp()
        }
      );

      setEditingAvatar(fallbackAvatar);
      setEditingAvatarType(fallbackType);

      setEditingProfile(current => ({
        ...current,
        avatar: fallbackAvatar,
        avatarType: fallbackType
      }));

      setCloudError('');
    } catch (error) {
      setCloudError(error.message);
    }
  };

  // ---------------- ELIMINAR PERFIL ----------------

  const deleteProfile = async profile => {
    if (!user || !profile) return;

    if (profiles.length <= 1) {
      setCloudError('Debes conservar al menos un perfil.');
      return;
    }

    const confirmed = window.confirm(
      `¿Eliminar el perfil "${profile.name}" y sus favoritos e historial? Esta acción no se puede deshacer.`
    );

    if (!confirmed) return;

    try {
      const base = [
        'users',
        user.uid,
        'profiles',
        profile.id
      ];

      const favoritesSnapshot = await getDocs(
        collection(db, ...base, 'favorites')
      );

      const historySnapshot = await getDocs(
        collection(db, ...base, 'history')
      );

      const batch = writeBatch(db);

      favoritesSnapshot.docs.forEach(item => {
        batch.delete(item.ref);
      });

      historySnapshot.docs.forEach(item => {
        batch.delete(item.ref);
      });

      batch.delete(doc(db, ...base));

      await batch.commit();

      if (activeProfile?.id === profile.id) {
        cancelMovieHistoryTimer();
        setActiveProfile(null);
        setFavorites([]);
        setWatchHistory([]);
        setSelectedItem(null);
      }

      if (editingProfile?.id === profile.id) {
        closeProfileEditor();
      }

      setCloudError('');
    } catch (error) {
      setCloudError(`No se pudo eliminar el perfil: ${error.message}`);
    }
  };

  // ---------------- AVATARES ----------------

  const renderProfileAvatar = (profile, size = 82) => {
    const isPreset = profile.avatarType === 'preset';

    return (
      <div
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: '12px',
          background: isPreset
            ? 'linear-gradient(135deg, #E50914, #711018)'
            : '#292929',
          display: 'grid',
          placeItems: 'center',
          overflow: 'hidden',
          flexShrink: 0,
          fontSize: `${size * 0.48}px`,
          fontWeight: 'bold',
          color: '#fff'
        }}
      >
        {isPreset && profile.avatar ? (
          profile.avatar
        ) : profile.avatar ? (
          <img
            src={profile.avatar}
            alt={profile.name}
            referrerPolicy="no-referrer"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
          />
        ) : (
          (profile.name || '?')[0].toUpperCase()
        )}
      </div>
    );
  };

  // ---------------- FAVORITOS E HISTORIAL ----------------

  useEffect(() => {
    if (!user || !activeProfile) return;

    const base = [
      'users',
      user.uid,
      'profiles',
      activeProfile.id
    ];

    const favQuery = query(
      collection(db, ...base, 'favorites')
    );

    const historyQuery = query(
      collection(db, ...base, 'history'),
      orderBy('updatedAt', 'desc')
    );

    const unsubFav = onSnapshot(
      favQuery,
      snap => setFavorites(
        snap.docs.map(d => ({ id: d.id, ...d.data() }))
      ),
      error => setCloudError(error.message)
    );

    const unsubHistory = onSnapshot(
      historyQuery,
      snap => setWatchHistory(
        snap.docs.map(d => ({ id: d.id, ...d.data() }))
      ),
      error => setCloudError(error.message)
    );

    return () => {
      unsubFav();
      unsubHistory();
    };
  }, [user, activeProfile]);

  const saveHistory = async (
    item,
    type = contentType,
    season = null,
    episode = null
  ) => {
    if (!user || !activeProfile || !item?.id) return;

    const key = `${type}_${item.id}`;

    const data = {
      tmdbId: item.id,
      type,
      title: item.title || item.name || 'Sin título',
      posterPath: item.poster_path || '',
      backdropPath: item.backdrop_path || '',
      overview: item.overview || '',
      voteAverage: item.vote_average || 0,
      season,
      episode,
      updatedAt: serverTimestamp()
    };

    try {
      await setDoc(
        doc(
          db,
          'users',
          user.uid,
          'profiles',
          activeProfile.id,
          'history',
          key
        ),
        data,
        { merge: true }
      );
    } catch (error) {
      setCloudError(error.message);
    }
  };

  const formatProgress = seconds => {
    const value = Number(seconds);

    if (!Number.isFinite(value) || value <= 0) return '';

    const totalMinutes = Math.floor(value / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return hours > 0
      ? `${hours} h ${minutes} min`
      : `${totalMinutes} min`;
  };

  const toggleFavorite = async () => {
    if (!user || !activeProfile || !selectedItem) return;

    const key = `${contentType}_${selectedItem.id}`;
    const existing = favorites.some(f => f.id === key);

    try {
      const ref = doc(
        db,
        'users',
        user.uid,
        'profiles',
        activeProfile.id,
        'favorites',
        key
      );

      if (existing) {
        await deleteDoc(ref);
      } else {
        await setDoc(ref, {
          tmdbId: selectedItem.id,
          type: contentType,
          title: selectedItem.title || selectedItem.name || 'Sin título',
          posterPath: selectedItem.poster_path || '',
          addedAt: serverTimestamp()
        });
      }
    } catch (error) {
      setCloudError(error.message);
    }
  };

  const clearProfileCollection = async collectionName => {
    if (!user || !activeProfile) return;

    const label = collectionName === 'history'
      ? 'el historial'
      : 'los favoritos';

    if (!window.confirm(
      `¿Seguro que deseas eliminar ${label} de este perfil?`
    )) return;

    try {
      const ref = collection(
        db,
        'users',
        user.uid,
        'profiles',
        activeProfile.id,
        collectionName
      );

      const snapshot = await getDocs(ref);
      const batch = writeBatch(db);

      snapshot.docs.forEach(item => batch.delete(item.ref));

      await batch.commit();
      setCloudError('');
    } catch (error) {
      setCloudError(error.message);
    }
  };

  // ---------------- REPRODUCTORES ----------------

  const getUnLimPlayUrl = (type, id, s, e) =>
    type === 'movie'
      ? `https://unlimplay.com/f/embed/movie/${id}`
      : `https://unlimplay.com/f/embed/tv/${id}/${s}/${e}`;

  const handleMovieMasterLoad = () => {
    const frame = movieMasterFrameRef.current;

    if (!frame || !frame.contentWindow) return;

    frame.contentWindow.postMessage(
      {
        type: 'mm:look',
        skin: 'minimal',
        color: 'e50914',
        info: true
      },
      'https://api.moviemaster.lat'
    );
  };

  const getPlayerUrl = (type, id, season, episode, server) => {
    const safeId = Number(id);
    const safeSeason = Number(season);
    const safeEpisode = Number(episode);

    if (!Number.isInteger(safeId) || safeId <= 0) {
      return null;
    }

    if (server === 'unlimplay') {
      return getUnLimPlayUrl(type, safeId, safeSeason, safeEpisode);
    }

    if (server === 'videoapi') {
      if (type === 'movie') {
        return `https://videoapi.la/e/movie/${safeId}`;
      }

      if (
        !Number.isInteger(safeSeason) ||
        !Number.isInteger(safeEpisode)
      ) return null;

      return `https://videoapi.la/e/tv/${safeId}/${safeSeason}/${safeEpisode}`;
    }

    if (server === 'moviemaster') {
      if (type === 'movie') {
        return `https://api.moviemaster.lat/e/movie/${safeId}`;
      }

      if (
        !Number.isInteger(safeSeason) ||
        safeSeason < 0 ||
        !Number.isInteger(safeEpisode) ||
        safeEpisode <= 0
      ) return null;

      return `https://api.moviemaster.lat/e/tv/${safeId}/${safeSeason}/${safeEpisode}`;
    }

    return null;
  };

  // ---------------- CATÁLOGO ----------------

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 40);

    window.addEventListener('scroll', handleScroll);

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (activeTab !== 'catalog') return;

    setSelectedGenre('');
    setSearchTerm('');
    setPage(1);

    axios.get(
      `https://api.themoviedb.org/3/genre/${contentType}/list?api_key=${API_KEY}&language=es-MX`
    )
      .then(response => setGenres(response.data.genres || []))
      .catch(console.error);
  }, [contentType, activeTab, API_KEY]);

  // ---------------- FILAS DEL CATÁLOGO ----------------

  useEffect(() => {
    if (
      activeTab !== 'catalog' ||
      selectedItem ||
      searchTerm.trim() !== '' ||
      selectedGenre !== ''
    ) return;

    let cancelled = false;

    const endpoints = contentType === 'movie'
      ? [
          { title: 'En cartelera', endpoint: 'now_playing' },
          { title: 'Más populares', endpoint: 'popular' },
          { title: 'Mejor valoradas', endpoint: 'top_rated' },
          { title: 'Próximos estrenos', endpoint: 'upcoming' }
        ]
      : [
          { title: 'Actualmente en emisión', endpoint: 'on_the_air' },
          { title: 'Series populares', endpoint: 'popular' },
          { title: 'Mejor valoradas', endpoint: 'top_rated' },
          { title: 'Emitidas hoy', endpoint: 'airing_today' }
        ];

    Promise.all(
      endpoints.map(async row => {
        const response = await axios.get(
          `https://api.themoviedb.org/3/${contentType}/${row.endpoint}?api_key=${API_KEY}&language=es-MX&page=1`
        );

        return {
          title: row.title,
          items: (response.data.results || [])
            .filter(item => item.poster_path)
        };
      })
    )
      .then(rows => {
        if (!cancelled) setCatalogRows(rows);
      })
      .catch(console.error);

    return () => {
      cancelled = true;
    };
  }, [
    activeTab,
    contentType,
    selectedItem,
    searchTerm,
    selectedGenre,
    API_KEY
  ]);

  // ---------------- BÚSQUEDA Y FILTROS ----------------

  useEffect(() => {
    if (activeTab !== 'catalog') return;

    let url = '';

    if (searchTerm.trim() !== '') {
      url =
        `https://api.themoviedb.org/3/search/${contentType}` +
        `?api_key=${API_KEY}` +
        `&language=es-MX` +
        `&query=${encodeURIComponent(searchTerm)}` +
        `&page=${page}`;
    } else if (selectedGenre !== '') {
      url =
        `https://api.themoviedb.org/3/discover/${contentType}` +
        `?api_key=${API_KEY}` +
        `&language=es-MX` +
        `&with_genres=${selectedGenre}` +
        `&sort_by=popularity.desc` +
        `&page=${page}`;
    } else {
      const endpoint = listType === 'latest'
        ? (contentType === 'movie' ? 'now_playing' : 'on_the_air')
        : 'popular';

      url =
        `https://api.themoviedb.org/3/${contentType}/${endpoint}` +
        `?api_key=${API_KEY}` +
        `&language=es-MX` +
        `&page=${page}`;
    }

    axios.get(url)
      .then(response => {
        let results = response.data.results || [];

        results = results.filter(item => {
          const date = item.release_date || item.first_air_date;

          if (!date) return false;

          const year = parseInt(date.split('-')[0], 10);

          if (listType === 'latest' && year < 2025) return false;

          return true;
        });

        setItems(results);
        setTotalPages(Math.min(response.data.total_pages || 1, 500));
      })
      .catch(console.error);

    let heroUrl = '';

    if (selectedGenre !== '') {
      heroUrl =
        `https://api.themoviedb.org/3/discover/${contentType}` +
        `?api_key=${API_KEY}` +
        `&language=es-MX` +
        `&with_genres=${selectedGenre}` +
        `&sort_by=popularity.desc`;
    } else {
      heroUrl =
        `https://api.themoviedb.org/3/${contentType}/` +
        `${contentType === 'movie' ? 'now_playing' : 'on_the_air'}` +
        `?api_key=${API_KEY}&language=es-MX`;
    }

    axios.get(heroUrl)
      .then(response => {
        const results = (response.data.results || [])
          .filter(item => item.backdrop_path)
          .filter(item => {
            const date = item.release_date || item.first_air_date;
            return date && parseInt(date.split('-')[0], 10) >= 2024;
          });

        setHeroItems(results.slice(0, 5));
        setCurrentHeroIndex(0);
      })
      .catch(console.error);
  }, [
    searchTerm,
    selectedGenre,
    contentType,
    page,
    activeTab,
    listType,
    API_KEY
  ]);

  // ---------------- ROTACIÓN DEL HERO ----------------

  useEffect(() => {
    if (heroItems.length === 0) return;

    const interval = setInterval(() => {
      setFadeAnim(false);

      setTimeout(() => {
        setCurrentHeroIndex(index => (index + 1) % heroItems.length);
        setFadeAnim(true);
      }, 500);
    }, 6000);

    return () => clearInterval(interval);
  }, [heroItems]);

  const handleGenreChange = genreId => {
    setSelectedGenre(genreId);
    setSearchTerm('');
    setPage(1);
  };

  const handleSearchChange = text => {
    setSearchTerm(text);
    setSelectedGenre('');
    setPage(1);
  };

  // ---------------- TEMPORADAS Y EPISODIOS ----------------

  const fetchEpisodes = async (
    tvId,
    seasonNumber,
    preferredEpisode = 1
  ) => {
    try {
      const response = await axios.get(
        `https://api.themoviedb.org/3/tv/${tvId}/season/${seasonNumber}?api_key=${API_KEY}&language=es-MX`
      );

      const list = response.data.episodes || [];

      setEpisodes(list);

      const episodeExists = list.some(
        ep => ep.episode_number === preferredEpisode
      );

      const episodeToLoad = episodeExists
        ? preferredEpisode
        : (list[0]?.episode_number || 1);

      setSelectedEpisode(episodeToLoad);

      return episodeToLoad;
    } catch (error) {
      console.error(error);
      setEpisodes([]);
      return null;
    }
  };

  const handleSeasonChange = async event => {
    const season = parseInt(event.target.value, 10);

    setSelectedSeason(season);
    setSelectedEpisode(1);

    if (selectedItem) {
      const episodeToLoad = await fetchEpisodes(
        selectedItem.id,
        season,
        1
      );

      if (episodeToLoad !== null) {
        await saveHistory(
          selectedItem,
          'tv',
          season,
          episodeToLoad
        );
      }
    }
  };

  const handleEpisodeChange = async event => {
    const episode = parseInt(event.target.value, 10);

    setSelectedEpisode(episode);

    if (selectedItem && contentType === 'tv') {
      await saveHistory(
        selectedItem,
        'tv',
        selectedSeason,
        episode
      );
    }
  };

  // ---------------- ABRIR CONTENIDO ----------------

  const handleSelectItem = async (item, requestedType = contentType) => {
    cancelMovieHistoryTimer();

    setContentType(requestedType);
    setSelectedItem(item);
    setItemTrailer(null);
    setSeasons([]);
    setEpisodes([]);
    setSelectedSeason(1);
    setSelectedEpisode(1);

    if (requestedType === 'movie') {
      const movieToSave = item;

      movieHistoryTimerRef.current = setTimeout(async () => {
        movieHistoryTimerRef.current = null;

        await saveHistory(
          movieToSave,
          'movie',
          null,
          null
        );
      }, 20 * 60 * 1000);
    }

    const historyEntry = watchHistory.find(
      entry => entry.id === `${requestedType}_${item.id}`
    );

    const savedSeason = historyEntry?.season || 1;
    const savedEpisode = historyEntry?.episode || 1;

    try {
      const videosResponse = await axios.get(
        `https://api.themoviedb.org/3/${requestedType}/${item.id}/videos?api_key=${API_KEY}&language=es-MX`
      );

      const videos = videosResponse.data.results || [];

      const trailer =
        videos.find(v => v.type === 'Trailer' && v.site === 'YouTube') ||
        videos.find(v => v.site === 'YouTube');

      if (trailer) setItemTrailer(trailer.key);
    } catch (error) {
      console.error(error);
    }

    if (requestedType === 'tv') {
      try {
        const response = await axios.get(
          `https://api.themoviedb.org/3/tv/${item.id}?api_key=${API_KEY}&language=es-MX`
        );

        const validSeasons = (response.data.seasons || [])
          .filter(season => season.season_number > 0);

        setSeasons(validSeasons);

        const seasonExists = validSeasons.some(
          season => season.season_number === savedSeason
        );

        const seasonToLoad = seasonExists
          ? savedSeason
          : validSeasons[0]?.season_number || 1;

        setSelectedSeason(seasonToLoad);

        const episodeToLoad = await fetchEpisodes(
          item.id,
          seasonToLoad,
          savedEpisode
        );

        if (episodeToLoad !== null) {
          await saveHistory(
            item,
            'tv',
            seasonToLoad,
            episodeToLoad
          );
        }
      } catch (error) {
        console.error(error);
      }
    }
  };

  const resumeHistoryItem = entry => {
    const item = {
      id: entry.tmdbId,
      title: entry.title,
      name: entry.title,
      poster_path: entry.posterPath,
      backdrop_path: entry.backdropPath || '',
      overview: entry.overview || '',
      vote_average: entry.voteAverage || 0
    };

    handleSelectItem(item, entry.type);
  };

  // ---------------- REPRODUCTOR LOCAL ----------------

  const handleFileUpload = event => {
    const file = event.target.files?.[0];

    if (file) {
      if (customVideoSource.startsWith('blob:')) {
        URL.revokeObjectURL(customVideoSource);
      }

      setCustomVideoSource(URL.createObjectURL(file));
    }
  };

  const handleUrlSubmit = event => {
    event.preventDefault();

    if (videoUrl.trim() !== '') {
      if (customVideoSource.startsWith('blob:')) {
        URL.revokeObjectURL(customVideoSource);
      }

      setCustomVideoSource(videoUrl.trim());
    }
  };

  const currentHero = heroItems.length > 0
    ? heroItems[currentHeroIndex]
    : null;

  const continueWatchingItems = watchHistory.filter(entry =>
    entry.tmdbId &&
    (entry.type === 'movie' || entry.type === 'tv')
  );

  // ---------------- ESTILOS AUXILIARES ----------------

  const profileCardStyle = {
    width: '160px',
    padding: '22px 14px',
    background: '#222',
    color: '#fff',
    border: '1px solid #444',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'transform .25s ease, border-color .25s ease, box-shadow .25s ease'
  };

  const posterCard = item => (
    <div
      key={item.id}
      onClick={() => handleSelectItem(item)}
      style={{
        background: '#181818',
        borderRadius: '8px',
        overflow: 'hidden',
        cursor: 'pointer',
        flex: '0 0 190px',
        minWidth: '190px',
        transition: 'transform .3s ease, box-shadow .3s ease',
        boxShadow: '0 4px 15px rgba(0,0,0,.6)'
      }}
      onMouseOver={event => {
        event.currentTarget.style.transform = 'scale(1.07) translateY(-5px)';
        event.currentTarget.style.zIndex = '10';
        event.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,.9)';
      }}
      onMouseOut={event => {
        event.currentTarget.style.transform = 'scale(1)';
        event.currentTarget.style.zIndex = '1';
        event.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,.6)';
      }}
    >
      {item.poster_path ? (
        <img
          src={`https://image.tmdb.org/t/p/w500${item.poster_path}`}
          alt={item.title || item.name}
          loading="lazy"
          style={{
            width: '100%',
            height: '285px',
            objectFit: 'cover',
            display: 'block'
          }}
        />
      ) : (
        <div style={{
          height: '285px',
          background: '#222',
          display: 'grid',
          placeItems: 'center',
          color: '#777'
        }}>
          Sin imagen
        </div>
      )}

      <div style={{ padding: '13px' }}>
        <h4 style={{
          fontSize: '14px',
          margin: 0,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          fontWeight: '600'
        }}>
          {item.title || item.name}
        </h4>
      </div>
    </div>
  );

  const horizontalRow = (title, rowItems) => (
    <section key={title} style={{ marginBottom: '42px' }}>
      <h3 style={{
        fontSize: '1.45rem',
        fontWeight: 'bold',
        margin: '0 0 17px'
      }}>
        {title}
      </h3>

      <div
        className="movie-row"
        style={{
          display: 'flex',
          gap: '22px',
          overflowX: 'auto',
          overflowY: 'hidden',
          padding: '12px 8px 25px',
          scrollBehavior: 'smooth',
          WebkitOverflowScrolling: 'touch',
          alignItems: 'stretch'
        }}
      >
        {rowItems.length > 0
          ? rowItems.map(posterCard)
          : <p style={{ color: '#888' }}>No hay contenido disponible.</p>}
      </div>
    </section>
  );

  // ---------------- INTERFAZ ----------------

  return (
    <div style={{
      backgroundColor: '#141414',
      color: '#fff',
      minHeight: '100vh',
      width: '100%',
      fontFamily: "'Helvetica Neue', Arial, sans-serif",
      overflowX: 'hidden',
      margin: 0,
      padding: 0,
      boxSizing: 'border-box'
    }}>
      <style>{`
        * { box-sizing: border-box; }

        .movie-row, .genre-row {
          scrollbar-width: thin;
          scrollbar-color: #666 #1b1b1b;
          overscroll-behavior-x: contain;
        }

        .movie-row::-webkit-scrollbar,
        .genre-row::-webkit-scrollbar {
          height: 9px;
        }

        .movie-row::-webkit-scrollbar-track,
        .genre-row::-webkit-scrollbar-track {
          background: #1b1b1b;
          border-radius: 10px;
        }

        .movie-row::-webkit-scrollbar-thumb,
        .genre-row::-webkit-scrollbar-thumb {
          background: #666;
          border-radius: 10px;
          border: 2px solid #1b1b1b;
        }

        .movie-row::-webkit-scrollbar-thumb:hover,
        .genre-row::-webkit-scrollbar-thumb:hover {
          background: #888;
        }

        button { -webkit-tap-highlight-color: transparent; }

        @media (max-width: 768px) {
          .main-catalog-content {
            padding-left: 20px !important;
            padding-right: 20px !important;
          }

          .hero-content {
            left: 22px !important;
            right: 22px !important;
            bottom: 12% !important;
          }

          .hero-content h2 { font-size: 2.2rem !important; }
          .detail-content { padding: 110px 20px 40px !important; }
          .main-nav { padding: 14px 18px !important; }
          .main-nav h1 { font-size: 1.35rem !important; }
          .main-nav-buttons { gap: 7px !important; }

          .main-nav-buttons button {
            padding: 7px 9px !important;
            font-size: 12px !important;
          }
        }

        @media (max-width: 480px) {
          .main-nav {
            align-items: flex-start !important;
            flex-direction: column !important;
            gap: 10px !important;
          }

          .main-nav-buttons {
            width: 100%;
            justify-content: space-between;
          }

          .hero-content h2 { font-size: 1.8rem !important; }
        }
      `}</style>

      {/* ---------------- CARGA ---------------- */}

      {authLoading ? (
        <div style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          color: '#aaa'
        }}>
          Conectando con Mi Cine Web...
        </div>
      ) : !user ? (

        /* ---------------- INICIO DE SESIÓN ---------------- */

        <div style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: '24px',
          background: 'radial-gradient(circle at top, #333 0%, #141414 55%)'
        }}>
          <div style={{
            width: 'min(440px, 100%)',
            textAlign: 'center',
            background: '#1d1d1d',
            padding: '42px 30px',
            borderRadius: '12px',
            border: '1px solid #383838',
            boxShadow: '0 20px 60px #000'
          }}>
            <h1 style={{ fontSize: '2.2rem', margin: '0 0 12px' }}>
              Mi Cine <span style={{ color: '#E50914' }}>Web</span>
            </h1>

            <p style={{ color: '#bbb', lineHeight: 1.6 }}>
              Inicia sesión para guardar tus perfiles, favoritos e historial en la nube.
            </p>

            <button
              onClick={handleGoogleLogin}
              style={{
                marginTop: '18px',
                width: '100%',
                padding: '13px',
                border: 0,
                borderRadius: '5px',
                background: '#fff',
                color: '#111',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              Continuar con Google
            </button>

            {cloudError && (
              <p style={{ color: '#ff7777', marginTop: '16px' }}>
                {cloudError}
              </p>
            )}
          </div>
        </div>

      ) : !activeProfile ? (

        /* ---------------- SELECTOR DE PERFILES ---------------- */

        <div style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: '30px',
          background: 'radial-gradient(circle at center, #292929 0%, #141414 65%)'
        }}>
          <div style={{ width: 'min(850px, 100%)', textAlign: 'center' }}>
            <h1 style={{
              fontSize: '2.5rem',
              fontWeight: '800',
              marginBottom: '10px'
            }}>
              ¿Quién está viendo?
            </h1>

            <p style={{ color: '#aaa', marginBottom: '35px' }}>
              Selecciona tu perfil para continuar
            </p>

            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '22px',
              flexWrap: 'wrap',
              margin: '30px 0'
            }}>
              {profiles.map(profile => (
                <button
                  key={profile.id}
                  onClick={() => {
                    cancelMovieHistoryTimer();
                    setActiveProfile(profile);
                  }}
                  style={profileCardStyle}
                  onMouseOver={event => {
                    event.currentTarget.style.transform = 'translateY(-7px) scale(1.04)';
                    event.currentTarget.style.borderColor = '#E50914';
                    event.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,.55)';
                  }}
                  onMouseOut={event => {
                    event.currentTarget.style.transform = 'translateY(0) scale(1)';
                    event.currentTarget.style.borderColor = '#444';
                    event.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    marginBottom: '14px'
                  }}>
                    {renderProfileAvatar(profile, 82)}
                  </div>

                  <div style={{
                    fontSize: '1rem',
                    fontWeight: '600',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {profile.name}
                  </div>
                </button>
              ))}
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '10px',
              flexWrap: 'wrap',
              marginTop: '30px'
            }}>
              <input
                value={profileName}
                maxLength={25}
                onChange={event => setProfileName(event.target.value)}
                placeholder="Nombre del nuevo perfil"
                style={{
                  padding: '12px',
                  background: '#222',
                  color: '#fff',
                  border: '1px solid #555',
                  borderRadius: '5px',
                  outline: 'none'
                }}
              />

              <button
                onClick={createProfile}
                disabled={profiles.length >= 5}
                style={{
                  padding: '12px 18px',
                  background: profiles.length >= 5 ? '#555' : '#E50914',
                  color: '#fff',
                  border: 0,
                  borderRadius: '5px',
                  cursor: profiles.length >= 5 ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold'
                }}
              >
                + Crear perfil
              </button>

              <button
                onClick={handleLogout}
                style={{
                  padding: '12px 18px',
                  background: '#333',
                  color: '#fff',
                  border: '1px solid #555',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                Cerrar sesión
              </button>
            </div>

            {cloudError && (
              <p style={{ color: '#ff7777' }}>{cloudError}</p>
            )}
          </div>
        </div>

      ) : (

        /* ---------------- APLICACIÓN PRINCIPAL ---------------- */

        <>
          {/* EDITOR DE PERFIL */}

          {editingProfile && (
            <div style={{
              position: 'fixed',
              inset: 0,
              zIndex: 4000,
              background: 'rgba(0,0,0,.9)',
              display: 'grid',
              placeItems: 'center',
              padding: '20px',
              overflowY: 'auto'
            }}>
              <div style={{
                width: 'min(560px, 100%)',
                background: '#1d1d1d',
                border: '1px solid #444',
                borderRadius: '14px',
                padding: '28px',
                boxShadow: '0 20px 60px #000'
              }}>
                <h2 style={{ marginTop: 0 }}>
                  Editar perfil
                </h2>

                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  margin: '25px 0'
                }}>
                  {renderProfileAvatar({
                    name: editingProfileName,
                    avatar: editingAvatar,
                    avatarType: editingAvatarType
                  }, 110)}
                </div>

                <label style={{
                  display: 'block',
                  color: '#aaa',
                  marginBottom: '8px'
                }}>
                  Nombre del perfil
                </label>

                <input
                  value={editingProfileName}
                  maxLength={25}
                  onChange={event => setEditingProfileName(event.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#292929',
                    border: '1px solid #555',
                    color: '#fff',
                    borderRadius: '6px',
                    marginBottom: '25px'
                  }}
                />

                <h3 style={{ fontSize: '1rem' }}>
                  Elige un avatar
                </h3>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '12px',
                  margin: '18px 0'
                }}>
                  {avatarPresets.map(avatar => (
                    <button
                      key={avatar}
                      onClick={() => selectPresetAvatar(avatar)}
                      style={{
                        height: '65px',
                        fontSize: '2rem',
                        cursor: 'pointer',
                        borderRadius: '10px',
                        background:
                          editingAvatar === avatar &&
                          editingAvatarType === 'preset'
                            ? '#5b171b'
                            : '#292929',
                        border:
                          editingAvatar === avatar &&
                          editingAvatarType === 'preset'
                            ? '2px solid #E50914'
                            : '1px solid #444'
                      }}
                    >
                      {avatar}
                    </button>
                  ))}
                </div>

                <button
                  onClick={useGoogleAvatar}
                  disabled={!user?.photoURL}
                  style={{
                    width: '100%',
                    padding: '12px',
                    marginBottom: '10px',
                    background: '#333',
                    border: '1px solid #555',
                    borderRadius: '6px',
                    color: user?.photoURL ? '#fff' : '#777',
                    cursor: user?.photoURL ? 'pointer' : 'not-allowed'
                  }}
                >
                  Usar mi foto de Google
                </button>

                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleAvatarUpload}
                  style={{ display: 'none' }}
                />

                <button
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#E50914',
                    border: 0,
                    borderRadius: '6px',
                    color: '#fff',
                    fontWeight: 'bold',
                    cursor: uploadingAvatar ? 'wait' : 'pointer',
                    marginBottom: '10px'
                  }}
                >
                  {uploadingAvatar
                    ? 'Procesando imagen...'
                    : '📷 Subir foto desde mi dispositivo'}
                </button>

                {editingAvatarType === 'upload' && (
                  <button
                    onClick={removeCustomAvatar}
                    style={{
                      width: '100%',
                      padding: '10px',
                      background: 'transparent',
                      color: '#ff7777',
                      border: '1px solid #733',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      marginBottom: '12px'
                    }}
                  >
                    Quitar foto personalizada
                  </button>
                )}

                {cloudError && (
                  <p style={{
                    color: '#ff7777',
                    fontSize: '13px',
                    overflowWrap: 'anywhere'
                  }}>
                    {cloudError}
                  </p>
                )}

                <div style={{
                  display: 'flex',
                  gap: '10px',
                  marginTop: '20px'
                }}>
                  <button
                    onClick={closeProfileEditor}
                    style={{
                      flex: 1,
                      padding: '12px',
                      background: '#333',
                      color: '#fff',
                      border: '1px solid #555',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    Cancelar
                  </button>

                  <button
                    onClick={saveProfileChanges}
                    disabled={uploadingAvatar}
                    style={{
                      flex: 1,
                      padding: '12px',
                      background: '#E50914',
                      color: '#fff',
                      border: 0,
                      borderRadius: '6px',
                      fontWeight: 'bold',
                      cursor: uploadingAvatar ? 'wait' : 'pointer'
                    }}
                  >
                    Guardar cambios
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* CONFIGURACIÓN DE CUENTA */}

          {showAccountSettings && (
            <div style={{
              position: 'fixed',
              inset: 0,
              zIndex: 3500,
              background: 'rgba(0,0,0,.9)',
              display: 'grid',
              placeItems: 'center',
              padding: '20px',
              overflowY: 'auto'
            }}>
              <div style={{
                width: 'min(650px, 100%)',
                maxHeight: '90vh',
                overflowY: 'auto',
                background: '#1d1d1d',
                border: '1px solid #444',
                borderRadius: '14px',
                padding: '28px',
                boxShadow: '0 20px 60px #000'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <h2 style={{ margin: 0 }}>
                    Configuración
                  </h2>

                  <button
                    onClick={() => setShowAccountSettings(false)}
                    style={{
                      background: '#333',
                      color: '#fff',
                      border: 0,
                      borderRadius: '6px',
                      padding: '8px 12px',
                      cursor: 'pointer'
                    }}
                  >
                    ✕
                  </button>
                </div>

                {/* CUENTA GOOGLE */}

                <section style={{
                  marginTop: '25px',
                  padding: '18px',
                  background: '#292929',
                  borderRadius: '10px'
                }}>
                  <h3 style={{ marginTop: 0 }}>
                    Cuenta de Google
                  </h3>

                  <div style={{
                    display: 'flex',
                    gap: '15px',
                    alignItems: 'center'
                  }}>
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt="Foto de Google"
                        referrerPolicy="no-referrer"
                        style={{
                          width: '58px',
                          height: '58px',
                          borderRadius: '50%',
                          objectFit: 'cover'
                        }}
                      />
                    ) : (
                      <div style={{
                        width: '58px',
                        height: '58px',
                        borderRadius: '50%',
                        background: '#E50914',
                        display: 'grid',
                        placeItems: 'center',
                        fontSize: '1.5rem'
                      }}>
                        {(user.displayName || 'U')[0].toUpperCase()}
                      </div>
                    )}

                    <div style={{ minWidth: 0 }}>
                      <strong>{user.displayName || 'Usuario'}</strong>
                      <p style={{
                        color: '#aaa',
                        margin: '5px 0 0',
                        overflowWrap: 'anywhere'
                      }}>
                        {user.email}
                      </p>
                    </div>
                  </div>
                </section>

                {/* PERFILES */}

                <section style={{ marginTop: '28px' }}>
                  <h3>Administrar perfiles</h3>

                  <p style={{
                    color: '#aaa',
                    fontSize: '13px'
                  }}>
                    Puedes tener hasta cinco perfiles. Cada uno mantiene sus propios favoritos e historial.
                  </p>

                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    {profiles.map(profile => (
                      <div
                        key={profile.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '12px',
                          background: '#292929',
                          borderRadius: '8px'
                        }}
                      >
                        {renderProfileAvatar(profile, 48)}

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <strong>{profile.name}</strong>

                          {activeProfile?.id === profile.id && (
                            <p style={{
                              color: '#46d369',
                              fontSize: '12px',
                              margin: '4px 0 0'
                            }}>
                              Perfil actual
                            </p>
                          )}
                        </div>

                        <button
                          onClick={() => openProfileEditor(profile)}
                          style={{
                            padding: '8px 12px',
                            background: '#444',
                            color: '#fff',
                            border: 0,
                            borderRadius: '5px',
                            cursor: 'pointer'
                          }}
                        >
                          Editar
                        </button>

                        <button
                          onClick={() => deleteProfile(profile)}
                          disabled={profiles.length <= 1}
                          title={profiles.length <= 1
                            ? 'Debes conservar al menos un perfil'
                            : 'Eliminar perfil'}
                          style={{
                            padding: '8px 12px',
                            background: '#4a1c1c',
                            color: profiles.length <= 1 ? '#888' : '#ffaaaa',
                            border: 0,
                            borderRadius: '5px',
                            cursor: profiles.length <= 1
                              ? 'not-allowed'
                              : 'pointer'
                          }}
                        >
                          🗑
                        </button>
                      </div>
                    ))}
                  </div>
                </section>

                {/* DATOS DEL PERFIL */}

                <section style={{ marginTop: '28px' }}>
                  <h3>Datos del perfil actual</h3>

                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <button
                      onClick={() => clearProfileCollection('history')}
                      style={{
                        padding: '12px',
                        background: '#292929',
                        border: '1px solid #555',
                        color: '#fff',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}
                    >
                      🕒 Borrar historial de este perfil
                    </button>

                    <button
                      onClick={() => clearProfileCollection('favorites')}
                      style={{
                        padding: '12px',
                        background: '#292929',
                        border: '1px solid #555',
                        color: '#fff',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}
                    >
                      ♥ Borrar favoritos de este perfil
                    </button>
                  </div>
                </section>

                {/* SESIÓN */}

                <section style={{ marginTop: '28px' }}>
                  <h3>Sesión</h3>

                  <button
                    onClick={handleLogout}
                    style={{
                      width: '100%',
                      padding: '13px',
                      background: '#E50914',
                      color: '#fff',
                      border: 0,
                      borderRadius: '6px',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                  >
                    Cerrar sesión
                  </button>
                </section>

                {cloudError && (
                  <p style={{
                    color: '#ff7777',
                    overflowWrap: 'anywhere',
                    marginTop: '18px'
                  }}>
                    {cloudError}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* SELECTOR SECUNDARIO DE PERFILES */}

          {showProfilePicker && (
            <div style={{
              position: 'fixed',
              inset: 0,
              zIndex: 2000,
              background: 'rgba(0,0,0,.88)',
              display: 'grid',
              placeItems: 'center',
              padding: '24px'
            }}>
              <div style={{
                background: '#1d1d1d',
                padding: '30px',
                borderRadius: '12px',
                width: 'min(650px, 100%)',
                textAlign: 'center',
                border: '1px solid #444',
                boxShadow: '0 20px 60px rgba(0,0,0,.7)'
              }}>
                <h2 style={{ marginTop: 0 }}>Elegir perfil</h2>

                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: '16px',
                  flexWrap: 'wrap',
                  margin: '24px 0'
                }}>
                  {profiles.map(profile => (
                    <button
                      key={profile.id}
                      onClick={() => {
                        cancelMovieHistoryTimer();
                        setActiveProfile(profile);
                        setShowProfilePicker(false);
                      }}
                      style={{
                        ...profileCardStyle,
                        width: '125px',
                        padding: '15px 10px'
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        justifyContent: 'center',
                        marginBottom: '12px'
                      }}>
                        {renderProfileAvatar(profile, 65)}
                      </div>

                      {profile.name}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setShowProfilePicker(false)}
                  style={{
                    background: 'transparent',
                    color: '#aaa',
                    border: 0,
                    cursor: 'pointer',
                    padding: '8px 16px'
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* ERROR DE FIREBASE */}

          {cloudError && (
            <div style={{
              position: 'fixed',
              bottom: 12,
              left: 12,
              zIndex: 3000,
              background: '#4b1717',
              padding: '10px 14px',
              borderRadius: 6,
              maxWidth: '90%',
              overflowWrap: 'anywhere'
            }}>
              Firebase: {cloudError}
            </div>
          )}

          {/* NAVEGACIÓN */}

          <nav
            className="main-nav"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100%',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '20px 60px',
              background: isScrolled
                ? 'linear-gradient(to bottom, rgba(0,0,0,.95), rgba(0,0,0,.6), transparent)'
                : 'linear-gradient(to bottom, rgba(0,0,0,.9), rgba(0,0,0,.4), transparent)',
              transition: 'background .4s ease',
              zIndex: 1000,
              boxSizing: 'border-box'
            }}
          >
            <h1
              style={{
                margin: 0,
                cursor: 'pointer',
                fontSize: '1.9rem',
                fontWeight: '900',
                letterSpacing: '.5px',
                textShadow: '2px 2px 8px rgba(0,0,0,.9)'
              }}
              onClick={() => {
                cancelMovieHistoryTimer();
                setActiveTab('catalog');
                setSelectedItem(null);
              }}
            >
              <span style={{ color: '#fff' }}>Mi Cine </span>
              <span style={{ color: '#E50914' }}>Web</span>
            </h1>

            <div
              className="main-nav-buttons"
              style={{
                display: 'flex',
                gap: '12px',
                alignItems: 'center',
                flexWrap: 'wrap'
              }}
            >
              <button
                onClick={() => {
                  cancelMovieHistoryTimer();
                  setActiveTab('catalog');
                  setSelectedItem(null);
                }}
                style={{
                  background: activeTab === 'catalog' ? '#E50914' : 'rgba(0,0,0,.5)',
                  color: '#fff',
                  border: activeTab === 'catalog' ? 'none' : '1px solid rgba(255,255,255,.3)',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Inicio
              </button>

              <button
                onClick={() => {
                  cancelMovieHistoryTimer();
                  setActiveTab('player');
                }}
                style={{
                  background: activeTab === 'player' ? '#E50914' : 'rgba(0,0,0,.5)',
                  color: '#fff',
                  border: activeTab === 'player' ? 'none' : '1px solid rgba(255,255,255,.3)',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                📁 Reproductor Local
              </button>

              <button
                onClick={() => setShowProfilePicker(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: '#222',
                  color: '#fff',
                  border: '1px solid #555',
                  padding: '6px 12px',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                {renderProfileAvatar(activeProfile, 30)}
                {activeProfile.name} ▾
              </button>

              <button
                onClick={() => setShowAccountSettings(true)}
                style={{
                  background: '#222',
                  color: '#fff',
                  border: '1px solid #555',
                  padding: '8px 12px',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                ⚙ Configuración
              </button>

              <button
                onClick={handleLogout}
                style={{
                  background: 'transparent',
                  color: '#fff',
                  border: '1px solid #555',
                  padding: '8px 12px',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Salir
              </button>
            </div>
          </nav>

          {/* REPRODUCTOR LOCAL */}

          {activeTab === 'player' && (
            <div style={{
              maxWidth: '900px',
              margin: '120px auto 60px',
              textAlign: 'center',
              padding: '0 20px'
            }}>
              <h2 style={{
                marginBottom: '20px',
                fontSize: '2.2rem',
                fontWeight: 'bold'
              }}>
                Reproductor Multimedia Personal
              </h2>

              <div style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '15px',
                marginBottom: '30px',
                flexWrap: 'wrap'
              }}>
                <div>
                  <input
                    type="file"
                    accept="video/*"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                  />

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      background: '#333',
                      color: '#fff',
                      border: 'none',
                      padding: '12px 24px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    📂 Seleccionar archivo local
                  </button>
                </div>

                <form
                  onSubmit={handleUrlSubmit}
                  style={{
                    display: 'flex',
                    gap: '10px',
                    flexWrap: 'wrap'
                  }}
                >
                  <input
                    type="url"
                    placeholder="https://ejemplo.com/video.mp4"
                    value={videoUrl}
                    onChange={event => setVideoUrl(event.target.value)}
                    style={{
                      padding: '10px 15px',
                      borderRadius: '4px',
                      border: '1px solid #444',
                      background: '#222',
                      color: '#fff',
                      width: '300px',
                      outline: 'none'
                    }}
                  />

                  <button
                    type="submit"
                    style={{
                      background: '#E50914',
                      color: '#fff',
                      border: 'none',
                      padding: '12px 24px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    Cargar URL
                  </button>
                </form>
              </div>

              {customVideoSource ? (
                <div style={{
                  background: '#000',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  boxShadow: '0 10px 40px rgba(0,0,0,.9)'
                }}>
                  <video
                    src={customVideoSource}
                    controls
                    autoPlay
                    style={{
                      width: '100%',
                      maxHeight: '550px',
                      display: 'block'
                    }}
                  />
                </div>
              ) : (
                <div style={{
                  border: '2px dashed #444',
                  borderRadius: '8px',
                  padding: '80px 20px',
                  color: '#777'
                }}>
                  <p>Ningún video seleccionado para reproducir.</p>
                </div>
              )}
            </div>
          )}

          {/* DETALLE DE PELÍCULA O SERIE */}

          {activeTab === 'catalog' && selectedItem && (
            <div style={{
              position: 'relative',
              width: '100%',
              minHeight: '100vh',
              background: '#141414',
              overflowX: 'hidden'
            }}>
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '700px',
                backgroundImage: `url(https://image.tmdb.org/t/p/original${selectedItem.backdrop_path || selectedItem.poster_path || ''})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center top',
                filter: 'brightness(.35)',
                zIndex: 1
              }} />

              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '700px',
                background: 'linear-gradient(to bottom, rgba(20,20,20,.4), rgba(20,20,20,.8) 60%, #141414)',
                zIndex: 2
              }} />

              <div
                className="detail-content"
                style={{
                  position: 'relative',
                  zIndex: 3,
                  padding: '130px 60px 60px',
                  maxWidth: '1300px',
                  margin: '0 auto'
                }}
              >
                <button
                  onClick={() => {
                    cancelMovieHistoryTimer();
                    setSelectedItem(null);
                  }}
                  style={{
                    background: 'rgba(51,51,51,.8)',
                    color: '#fff',
                    border: '1px solid #666',
                    padding: '10px 22px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '15px',
                    marginBottom: '30px',
                    fontWeight: 'bold',
                    backdropFilter: 'blur(5px)'
                  }}
                >
                  ⬅ Volver al catálogo
                </button>

                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '50px',
                  alignItems: 'flex-start'
                }}>
                  <div style={{ flex: 2, minWidth: '320px' }}>
                    <h2 style={{
                      fontSize: '3.2rem',
                      marginBottom: '10px',
                      textShadow: '2px 2px 10px rgba(0,0,0,.9)',
                      fontWeight: '900'
                    }}>
                      {selectedItem.title || selectedItem.name}
                    </h2>

                    <p style={{
                      color: '#aaa',
                      fontSize: '1.05rem',
                      marginBottom: '25px'
                    }}>
                      📅 Estreno: {
                        selectedItem.release_date ||
                        selectedItem.first_air_date ||
                        'Desconocida'
                      }
                      &nbsp;|&nbsp; ⭐ Calificación:{' '}
                      <strong style={{ color: '#46d369' }}>
                        {selectedItem.vote_average || 0} / 10
                      </strong>
                    </p>

                    <div style={{ marginBottom: '30px' }}>
                      <h3 style={{
                        borderBottom: '3px solid #E50914',
                        paddingBottom: '6px',
                        display: 'inline-block',
                        marginBottom: '12px',
                        fontSize: '1.3rem'
                      }}>
                        Sinopsis
                      </h3>

                      <p style={{
                        fontSize: '1.1rem',
                        lineHeight: '1.7',
                        color: '#e5e5e5'
                      }}>
                        {selectedItem.overview || 'No hay sinopsis disponible en español.'}
                      </p>

                      <button
                        onClick={toggleFavorite}
                        style={{
                          marginTop: '12px',
                          background: favorites.some(
                            f => f.id === `${contentType}_${selectedItem.id}`
                          ) ? '#E50914' : '#333',
                          color: '#fff',
                          border: '1px solid #666',
                          borderRadius: '5px',
                          padding: '10px 16px',
                          cursor: 'pointer',
                          fontWeight: 'bold'
                        }}
                      >
                        {favorites.some(
                          f => f.id === `${contentType}_${selectedItem.id}`
                        ) ? '♥ En mi lista' : '＋ Añadir a mi lista'}
                      </button>
                    </div>

                    {/* TEMPORADAS Y EPISODIOS */}

                    {contentType === 'tv' && seasons.length > 0 && (
                      <div style={{
                        marginBottom: '30px',
                        background: 'rgba(24,24,24,.85)',
                        padding: '20px 25px',
                        borderRadius: '8px',
                        display: 'flex',
                        gap: '25px',
                        flexWrap: 'wrap',
                        borderLeft: '5px solid #E50914',
                        backdropFilter: 'blur(10px)',
                        boxShadow: '0 8px 25px rgba(0,0,0,.8)'
                      }}>
                        <div>
                          <label style={{
                            display: 'block',
                            marginBottom: '8px',
                            fontWeight: 'bold',
                            color: '#aaa'
                          }}>
                            Temporada:
                          </label>

                          <select
                            value={selectedSeason}
                            onChange={handleSeasonChange}
                            style={{
                              padding: '10px 14px',
                              borderRadius: '4px',
                              background: '#222',
                              color: '#fff',
                              border: '1px solid #555',
                              cursor: 'pointer',
                              fontSize: '1rem'
                            }}
                          >
                            {seasons.map(season => (
                              <option
                                key={season.id}
                                value={season.season_number}
                              >
                                Temporada {season.season_number}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label style={{
                            display: 'block',
                            marginBottom: '8px',
                            fontWeight: 'bold',
                            color: '#aaa'
                          }}>
                            Capítulo:
                          </label>

                          <select
                            value={selectedEpisode}
                            onChange={handleEpisodeChange}
                            style={{
                              padding: '10px 14px',
                              borderRadius: '4px',
                              background: '#222',
                              color: '#fff',
                              border: '1px solid #555',
                              cursor: 'pointer',
                              fontSize: '1rem'
                            }}
                          >
                            {episodes.map(episode => (
                              <option
                                key={episode.id}
                                value={episode.episode_number}
                              >
                                {episode.episode_number}. {episode.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    {/* SELECTOR DE SERVIDOR */}

                    <div style={{
                      marginBottom: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      flexWrap: 'wrap'
                    }}>
                      <label
                        htmlFor="server-select"
                        style={{ color: '#aaa', fontWeight: 'bold' }}
                      >
                        Servidor:
                      </label>

                      <select
                        id="server-select"
                        value={selectedServer}
                        onChange={event => setSelectedServer(event.target.value)}
                        style={{
                          padding: '10px 14px',
                          borderRadius: '4px',
                          background: '#222',
                          color: '#fff',
                          border: '1px solid #555',
                          cursor: 'pointer',
                          fontSize: '1rem'
                        }}
                      >
                        <option value="unlimplay">Unlimplay</option>
                        <option value="videoapi">VideoAPI</option>
                        <option value="moviemaster">MovieMaster</option>
                      </select>
                    </div>

                    {/* REPRODUCTOR AUTOMÁTICO */}

                    {(() => {
                      const playerUrl = getPlayerUrl(
                        contentType,
                        selectedItem.id,
                        selectedSeason,
                        selectedEpisode,
                        selectedServer
                      );

                      if (!playerUrl) {
                        return (
                          <div style={{
                            background: '#181818',
                            border: '1px solid #555',
                            borderRadius: '10px',
                            padding: '24px',
                            marginBottom: '25px',
                            color: '#ccc',
                            lineHeight: '1.6'
                          }}>
                            <strong style={{ color: '#fff' }}>
                              No se pudo generar la dirección del reproductor.
                            </strong>
                            <br />
                            Comprueba que el contenido tenga un identificador válido en TMDB.
                          </div>
                        );
                      }

                      return (
                        <div style={{
                          position: 'relative',
                          paddingBottom: '56.25%',
                          height: 0,
                          overflow: 'hidden',
                          borderRadius: '10px',
                          boxShadow: '0 15px 50px rgba(0,0,0,.95)',
                          background: '#000',
                          marginBottom: '20px',
                          border: '1px solid #333'
                        }}>
                          <iframe
                            key={`${selectedServer}-${contentType}-${selectedItem.id}-${selectedSeason}-${selectedEpisode}`}
                            src={playerUrl}
                            title={`Reproductor ${selectedServer}`}
                            ref={
                              selectedServer === 'moviemaster'
                                ? movieMasterFrameRef
                                : null
                            }
                            onLoad={
                              selectedServer === 'moviemaster'
                                ? handleMovieMasterLoad
                                : undefined
                            }
                            referrerPolicy={
                              selectedServer === 'videoapi'
                                ? 'origin'
                                : 'strict-origin-when-cross-origin'
                            }
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              height: '100%',
                              border: 'none'
                            }}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                            allowFullScreen
                          />
                        </div>
                      );
                    })()}
                  </div>

                  <div style={{
                    flex: 1,
                    minWidth: '260px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '25px'
                  }}>
                    {selectedItem.poster_path && (
                      <img
                        src={`https://image.tmdb.org/t/p/w500${selectedItem.poster_path}`}
                        alt={selectedItem.title || selectedItem.name}
                        style={{
                          width: '100%',
                          maxWidth: '300px',
                          borderRadius: '10px',
                          boxShadow: '0 15px 40px rgba(0,0,0,.9)',
                          border: '1px solid #444'
                        }}
                      />
                    )}

                    {itemTrailer && (
                      <div style={{ width: '100%', maxWidth: '300px' }}>
                        <h3 style={{
                          borderBottom: '2px solid #E50914',
                          paddingBottom: '4px',
                          marginBottom: '10px',
                          fontSize: '1.1rem',
                          color: '#ddd'
                        }}>
                          Tráiler Oficial
                        </h3>

                        <div style={{
                          position: 'relative',
                          paddingBottom: '56.25%',
                          height: 0,
                          overflow: 'hidden',
                          borderRadius: '8px',
                          boxShadow: '0 8px 25px rgba(0,0,0,.8)',
                          background: '#000',
                          border: '1px solid #333'
                        }}>
                          <iframe
                            src={`https://www.youtube.com/embed/${itemTrailer}`}
                            title="Tráiler de YouTube"
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              height: '100%',
                              border: 'none'
                            }}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CATÁLOGO PRINCIPAL */}

          {activeTab === 'catalog' && !selectedItem && (
            <div>
              {/* HERO */}

              {currentHero && (
                <div style={{
                  position: 'relative',
                  height: '75vh',
                  width: '100%',
                  backgroundImage: `url(https://image.tmdb.org/t/p/original${currentHero.backdrop_path || currentHero.poster_path})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center top',
                  opacity: fadeAnim ? 1 : 0,
                  transition: 'opacity .6s ease-in-out'
                }}>
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(to top, #141414 0%, rgba(20,20,20,.6) 40%, rgba(20,20,20,.2) 100%), linear-gradient(to right, #141414 15%, transparent 60%)'
                  }} />

                  <div
                    className="hero-content"
                    style={{
                      position: 'absolute',
                      bottom: '15%',
                      left: '60px',
                      maxWidth: '650px',
                      zIndex: 2
                    }}
                  >
                    <h2 style={{
                      fontSize: '3.5rem',
                      fontWeight: '900',
                      margin: '0 0 15px',
                      textShadow: '2px 2px 10px rgba(0,0,0,.8)'
                    }}>
                      {currentHero.title || currentHero.name}
                    </h2>

                    <p style={{
                      fontSize: '1.1rem',
                      lineHeight: '1.6',
                      color: '#ddd',
                      marginBottom: '25px',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      textShadow: '1px 1px 5px rgba(0,0,0,.8)'
                    }}>
                      {currentHero.overview}
                    </p>

                    <div style={{
                      display: 'flex',
                      gap: '15px',
                      alignItems: 'center',
                      flexWrap: 'wrap'
                    }}>
                      <button
                        onClick={() => handleSelectItem(currentHero)}
                        style={{
                          background: '#fff',
                          color: '#000',
                          border: 'none',
                          padding: '12px 30px',
                          borderRadius: '6px',
                          fontSize: '1.1rem',
                          fontWeight: 'bold',
                          cursor: 'pointer'
                        }}
                      >
                        ▶ Ver y reproducir
                      </button>

                      <button
                        onClick={() => handleSelectItem(currentHero)}
                        style={{
                          background: 'rgba(109,109,110,.7)',
                          color: '#fff',
                          border: 'none',
                          padding: '12px 30px',
                          borderRadius: '6px',
                          fontSize: '1.1rem',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          backdropFilter: 'blur(5px)'
                        }}
                      >
                        ℹ Más información
                      </button>

                      <div style={{
                        display: 'flex',
                        gap: '8px',
                        marginLeft: '20px'
                      }}>
                        {heroItems.map((_, index) => (
                          <span
                            key={index}
                            onClick={() => {
                              setFadeAnim(false);

                              setTimeout(() => {
                                setCurrentHeroIndex(index);
                                setFadeAnim(true);
                              }, 300);
                            }}
                            style={{
                              width: index === currentHeroIndex ? '24px' : '8px',
                              height: '8px',
                              borderRadius: '4px',
                              background: index === currentHeroIndex
                                ? '#E50914'
                                : 'rgba(255,255,255,.4)',
                              cursor: 'pointer',
                              transition: 'all .3s ease'
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* CONTENIDO DEL CATÁLOGO */}

              <div
                className="main-catalog-content"
                style={{
                  padding: '40px 60px',
                  boxSizing: 'border-box'
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '20px',
                  marginBottom: '30px'
                }}>
                  <div style={{
                    display: 'flex',
                    gap: '20px',
                    flexWrap: 'wrap'
                  }}>
                    {/* PELÍCULAS / SERIES */}

                    <div style={{
                      display: 'flex',
                      background: '#181818',
                      borderRadius: '8px',
                      padding: '4px',
                      border: '1px solid #333'
                    }}>
                      <button
                        onClick={() => {
                          setContentType('movie');
                          setPage(1);
                        }}
                        style={{
                          background: contentType === 'movie' ? '#E50914' : 'transparent',
                          color: '#fff',
                          border: 'none',
                          padding: '10px 20px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: 'bold'
                        }}
                      >
                        Películas
                      </button>

                      <button
                        onClick={() => {
                          setContentType('tv');
                          setPage(1);
                        }}
                        style={{
                          background: contentType === 'tv' ? '#E50914' : 'transparent',
                          color: '#fff',
                          border: 'none',
                          padding: '10px 20px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: 'bold'
                        }}
                      >
                        Series
                      </button>
                    </div>

                    {/* POPULARES / ESTRENOS */}

                    <div style={{
                      display: 'flex',
                      background: '#181818',
                      borderRadius: '8px',
                      padding: '4px',
                      border: '1px solid #333'
                    }}>
                      <button
                        onClick={() => {
                          setListType('popular');
                          setPage(1);
                          setSelectedGenre('');
                          setSearchTerm('');
                        }}
                        style={{
                          background: listType === 'popular' ? '#333' : 'transparent',
                          color: '#fff',
                          border: 'none',
                          padding: '10px 20px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: 'bold'
                        }}
                      >
                        🔥 Populares
                      </button>

                      <button
                        onClick={() => {
                          setListType('latest');
                          setPage(1);
                          setSelectedGenre('');
                          setSearchTerm('');
                        }}
                        style={{
                          background: listType === 'latest' ? '#333' : 'transparent',
                          color: '#fff',
                          border: 'none',
                          padding: '10px 20px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: 'bold'
                        }}
                      >
                        ✨ Estrenos
                      </button>
                    </div>
                  </div>

                  {/* BUSCADOR */}

                  <input
                    type="text"
                    placeholder={contentType === 'movie'
                      ? 'Buscar películas...'
                      : 'Buscar series...'}
                    value={searchTerm}
                    onChange={event => handleSearchChange(event.target.value)}
                    style={{
                      padding: '12px 20px',
                      borderRadius: '6px',
                      border: '1px solid #333',
                      background: '#181818',
                      color: '#fff',
                      width: '280px',
                      fontSize: '15px',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* GÉNEROS */}

                <div
                  className="genre-row"
                  style={{
                    display: 'flex',
                    gap: '12px',
                    overflowX: 'auto',
                    overflowY: 'hidden',
                    paddingBottom: '20px',
                    marginBottom: '25px',
                    whiteSpace: 'nowrap',
                    WebkitOverflowScrolling: 'touch'
                  }}
                >
                  <button
                    onClick={() => handleGenreChange('')}
                    style={{
                      background: selectedGenre === '' ? '#E50914' : '#222',
                      color: '#fff',
                      border: selectedGenre === '' ? 'none' : '1px solid #444',
                      padding: '8px 22px',
                      borderRadius: '20px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      flexShrink: 0
                    }}
                  >
                    Todas
                  </button>

                  {genres.map(genre => (
                    <button
                      key={genre.id}
                      onClick={() => handleGenreChange(genre.id)}
                      style={{
                        background: selectedGenre === genre.id ? '#E50914' : '#222',
                        color: '#fff',
                        border: selectedGenre === genre.id ? 'none' : '1px solid #444',
                        padding: '8px 22px',
                        borderRadius: '20px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        flexShrink: 0
                      }}
                    >
                      {genre.name}
                    </button>
                  ))}
                </div>

                {/* CONTINUAR VIENDO */}

                {continueWatchingItems.length > 0 &&
                  searchTerm.trim() === '' &&
                  selectedGenre === '' &&
                  listType === 'popular' && (
                    <section style={{ marginBottom: '42px' }}>
                      <h3 style={{
                        fontSize: '1.45rem',
                        fontWeight: 'bold',
                        margin: '0 0 17px'
                      }}>
                        Continuar viendo
                      </h3>

                      <div
                        className="movie-row"
                        style={{
                          display: 'flex',
                          gap: '22px',
                          overflowX: 'auto',
                          overflowY: 'hidden',
                          padding: '12px 8px 25px',
                          scrollBehavior: 'smooth',
                          WebkitOverflowScrolling: 'touch'
                        }}
                      >
                        {continueWatchingItems.map(entry => (
                          <div
                            key={entry.id}
                            onClick={() => resumeHistoryItem(entry)}
                            style={{
                              flex: '0 0 190px',
                              minWidth: '190px',
                              background: '#181818',
                              borderRadius: '8px',
                              overflow: 'hidden',
                              cursor: 'pointer',
                              transition: 'transform .3s ease',
                              boxShadow: '0 4px 15px rgba(0,0,0,.6)'
                            }}
                            onMouseOver={event => {
                              event.currentTarget.style.transform = 'scale(1.06) translateY(-5px)';
                            }}
                            onMouseOut={event => {
                              event.currentTarget.style.transform = 'scale(1)';
                            }}
                          >
                            {entry.posterPath ? (
                              <img
                                src={`https://image.tmdb.org/t/p/w500${entry.posterPath}`}
                                alt={entry.title}
                                loading="lazy"
                                style={{
                                  width: '100%',
                                  height: '285px',
                                  objectFit: 'cover',
                                  display: 'block'
                                }}
                              />
                            ) : (
                              <div style={{
                                height: '285px',
                                background: '#222',
                                display: 'grid',
                                placeItems: 'center',
                                color: '#777'
                              }}>
                                Sin imagen
                              </div>
                            )}

                            <div style={{ padding: '13px' }}>
                              <h4 style={{
                                fontSize: '14px',
                                margin: '0 0 7px',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}>
                                {entry.title}
                              </h4>

                              {entry.type === 'tv' ? (
                                <p style={{
                                  color: '#aaa',
                                  fontSize: '12px',
                                  margin: 0
                                }}>
                                  Temporada {entry.season || 1}
                                  {' · '}
                                  Episodio {entry.episode || 1}
                                </p>
                              ) : (
                                <p style={{
                                  color: '#aaa',
                                  fontSize: '12px',
                                  margin: 0
                                }}>
                                  Película
                                </p>
                              )}

                              {Number(entry.progressSeconds) > 0 && (
                                <p style={{
                                  color: '#888',
                                  fontSize: '11px',
                                  margin: '5px 0 0'
                                }}>
                                  Progreso: {formatProgress(entry.progressSeconds)}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                {/* CATÁLOGO CON VARIAS FILAS */}

                {searchTerm.trim() === '' && selectedGenre === '' ? (
                  <>
                    {catalogRows.length > 0 ? (
                      catalogRows.map(row =>
                        horizontalRow(row.title, row.items)
                      )
                    ) : (
                      <p style={{
                        color: '#aaa',
                        padding: '35px 0'
                      }}>
                        Cargando catálogo...
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <h3 style={{
                      fontSize: '1.5rem',
                      fontWeight: 'bold',
                      marginBottom: '20px'
                    }}>
                      {searchTerm
                        ? 'Resultados de búsqueda'
                        : contentType === 'movie'
                          ? 'Películas por género'
                          : 'Series por género'}
                    </h3>

                    <div
                      className="movie-row"
                      style={{
                        display: 'flex',
                        gap: '25px',
                        overflowX: 'auto',
                        overflowY: 'hidden',
                        padding: '12px 8px 25px',
                        scrollBehavior: 'smooth',
                        WebkitOverflowScrolling: 'touch',
                        alignItems: 'stretch'
                      }}
                    >
                      {items.length > 0 ? (
                        items.map(posterCard)
                      ) : (
                        <p style={{
                          color: '#aaa',
                          padding: '40px 0',
                          fontSize: '1.1rem'
                        }}>
                          No se encontraron resultados.
                        </p>
                      )}
                    </div>

                    {/* PAGINACIÓN */}

                    <div style={{
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      gap: '25px',
                      margin: '40px 0 60px',
                      flexWrap: 'wrap'
                    }}>
                      <button
                        onClick={() => setPage(prev => Math.max(prev - 1, 1))}
                        disabled={page === 1}
                        style={{
                          background: page === 1 ? '#222' : '#E50914',
                          color: page === 1 ? '#666' : '#fff',
                          border: 'none',
                          padding: '12px 24px',
                          borderRadius: '4px',
                          cursor: page === 1 ? 'not-allowed' : 'pointer',
                          fontWeight: 'bold'
                        }}
                      >
                        ⬅ Anterior
                      </button>

                      <span style={{
                        fontSize: '16px',
                        color: '#aaa'
                      }}>
                        Página <strong>{page}</strong> de {totalPages}
                      </span>

                      <button
                        onClick={() => setPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={page === totalPages}
                        style={{
                          background: page === totalPages ? '#222' : '#E50914',
                          color: page === totalPages ? '#666' : '#fff',
                          border: 'none',
                          padding: '12px 24px',
                          borderRadius: '4px',
                          cursor: page === totalPages ? 'not-allowed' : 'pointer',
                          fontWeight: 'bold'
                        }}
                      >
                        Siguiente ➡
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default App;