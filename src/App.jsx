import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';

function App() {
  const [activeTab, setActiveTab] = useState('catalog');
  const [contentType, setContentType] = useState('movie');
  const [listType, setListType] = useState('popular'); // Nuevo estado para Populares/Estrenos
  const [items, setItems] = useState([]);
  const [genres, setGenres] = useState([]);
  const [selectedGenre, setSelectedGenre] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemTrailer, setItemTrailer] = useState(null);

  // Estados dinámicos para Series (TV)
  const [seasons, setSeasons] = useState([]);
  const [episodes, setEpisodes] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [selectedEpisode, setSelectedEpisode] = useState(1);

  const [videoUrl, setVideoUrl] = useState('');
  const [customVideoSource, setCustomVideoSource] = useState('');
  const fileInputRef = useRef(null);
  
  const API_KEY = import.meta.env.VITE_TMDB_API_KEY;

  // Motor Único: 100% Latino. Recibe parámetros de temporada y capítulo.
  const getUnLimPlayUrl = (type, id, s, e) => type === 'movie' 
    ? `https://unlimplay.com/f/embed/movie/${id}` 
    : `https://unlimplay.com/f/embed/tv/${id}/${s}/${e}`;

  useEffect(() => {
    if (activeTab === 'catalog') {
      setSelectedGenre('');
      setSearchTerm('');
      setPage(1);
      axios.get(`https://api.themoviedb.org/3/genre/${contentType}/list?api_key=${API_KEY}&language=es-MX`)
        .then(response => setGenres(response.data.genres))
        .catch(console.error);
    }
  }, [contentType, activeTab, API_KEY]); 

  useEffect(() => {
    if (activeTab !== 'catalog') return;
    
    let url = '';
    if (searchTerm.trim() !== '') {
      url = `https://api.themoviedb.org/3/search/${contentType}?api_key=${API_KEY}&language=es-MX&query=${searchTerm}&page=${page}`;
    } else if (selectedGenre !== '') {
      url = `https://api.themoviedb.org/3/discover/${contentType}?api_key=${API_KEY}&language=es-MX&with_genres=${selectedGenre}&page=${page}`;
    } else {
      // Alterna entre los más vistos (popular) o los últimos estrenos (now_playing / on_the_air)
      const endpoint = listType === 'latest' 
        ? (contentType === 'movie' ? 'now_playing' : 'on_the_air') 
        : 'popular';
      url = `https://api.themoviedb.org/3/${contentType}/${endpoint}?api_key=${API_KEY}&language=es-MX&page=${page}`;
    }

    axios.get(url).then(response => {
      setItems(response.data.results);
      setTotalPages(response.data.total_pages > 500 ? 500 : response.data.total_pages);
    }).catch(console.error);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [searchTerm, selectedGenre, contentType, page, activeTab, API_KEY, listType]); 

  const handleGenreChange = (genreId) => {
    setSelectedGenre(genreId);
    setSearchTerm('');
    setPage(1);
  };

  const handleSearchChange = (text) => {
    setSearchTerm(text);
    setSelectedGenre('');
    setPage(1);
  };

  const fetchEpisodes = (tvId, seasonNumber) => {
    axios.get(`https://api.themoviedb.org/3/tv/${tvId}/season/${seasonNumber}?api_key=${API_KEY}&language=es-MX`)
      .then(res => setEpisodes(res.data.episodes))
      .catch(console.error);
  };

  const handleSeasonChange = (e) => {
    const s = parseInt(e.target.value);
    setSelectedSeason(s);
    setSelectedEpisode(1); 
    fetchEpisodes(selectedItem.id, s);
  };

  const handleSelectItem = (item) => {
    setSelectedItem(item);
    setItemTrailer(null);
    setSeasons([]);
    setEpisodes([]);
    setSelectedSeason(1);
    setSelectedEpisode(1);

    // Obtener Tráiler
    axios.get(`https://api.themoviedb.org/3/${contentType}/${item.id}/videos?api_key=${API_KEY}&language=es-MX`)
      .then(response => {
        const videos = response.data.results;
        const trailer = videos.find(v => v.type === 'Trailer' && v.site === 'YouTube') || videos.find(v => v.site === 'YouTube');
        if (trailer) setItemTrailer(trailer.key);
      }).catch(console.error);

    // Obtener Temporadas si es una serie
    if (contentType === 'tv') {
      axios.get(`https://api.themoviedb.org/3/tv/${item.id}?api_key=${API_KEY}&language=es-MX`)
        .then(res => {
          const validSeasons = res.data.seasons.filter(s => s.season_number > 0);
          setSeasons(validSeasons);
          if (validSeasons.length > 0) {
            const firstSeason = validSeasons[0].season_number;
            setSelectedSeason(firstSeason);
            fetchEpisodes(item.id, firstSeason);
          }
        }).catch(console.error);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) setCustomVideoSource(URL.createObjectURL(file));
  };

  const handleUrlSubmit = (e) => {
    e.preventDefault();
    if (videoUrl.trim() !== '') setCustomVideoSource(videoUrl.trim());
  };

  return (
    <div style={{ backgroundColor: '#141414', color: '#fff', minHeight: '100vh', padding: '20px', fontFamily: 'sans-serif' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333', paddingBottom: '15px', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
        <h1 style={{ margin: 0, cursor: 'pointer' }} onClick={() => { setActiveTab('catalog'); setSelectedItem(null); }}>
          🎬 <span style={{ color: '#fff' }}>Mi Cine</span> <span style={{ color: '#e50914' }}>Web</span>
        </h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => { setActiveTab('catalog'); setSelectedItem(null); }} style={{ backgroundColor: activeTab === 'catalog' ? '#e50914' : '#222', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Películas y Series</button>
          <button onClick={() => setActiveTab('player')} style={{ backgroundColor: activeTab === 'player' ? '#e50914' : '#222', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>📁 Local / URL</button>
        </div>
      </div>

      {activeTab === 'player' && (
        <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center', paddingBottom: '40px' }}>
          <h2 style={{ marginBottom: '10px' }}>Reproductor Multimedia Personal</h2>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '30px', flexWrap: 'wrap' }}>
            <div>
              <input type="file" accept="video/*" ref={fileInputRef} onChange={handleFileUpload} style={{ display: 'none' }} />
              <button onClick={() => fileInputRef.current.click()} style={{ backgroundColor: '#333', color: '#fff', border: '1px solid #555', padding: '12px 20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>📂 Seleccionar archivo</button>
            </div>
            <form onSubmit={handleUrlSubmit} style={{ display: 'flex', gap: '10px' }}>
              <input type="url" placeholder="https://ejemplo.com/video.mp4" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} style={{ padding: '10px 15px', borderRadius: '4px', border: '1px solid #333', backgroundColor: '#222', color: '#fff', width: '280px' }} />
              <button type="submit" style={{ backgroundColor: '#e50914', color: '#fff', border: 'none', padding: '10px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Cargar URL</button>
            </form>
          </div>
          {customVideoSource ? (
            <div style={{ backgroundColor: '#000', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.8)' }}>
              <video src={customVideoSource} controls autoPlay style={{ width: '100%', maxHeight: '500px', display: 'block' }}></video>
            </div>
          ) : (
            <div style={{ border: '2px dashed #444', borderRadius: '8px', padding: '60px 20px', color: '#666' }}><p>Ningún video seleccionado.</p></div>
          )}
        </div>
      )}

      {activeTab === 'catalog' && selectedItem && (
        <div>
          <button onClick={() => setSelectedItem(null)} style={{ backgroundColor: '#333', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer', fontSize: '16px', marginBottom: '20px', fontWeight: 'bold' }}>⬅ Volver al catálogo</button>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '40px', marginTop: '10px', alignItems: 'flex-start' }}>
            <div style={{ flex: 2, minWidth: '300px', maxWidth: '800px' }}>
              <h2 style={{ fontSize: '28px', marginBottom: '15px' }}>▶ Reproduciendo: {selectedItem.title || selectedItem.name}</h2>
              <p style={{ color: '#aaa', fontSize: '14px', marginBottom: '20px' }}>📅 Estreno: {selectedItem.release_date || selectedItem.first_air_date || 'Desconocida'} | ⭐ Calificación: {selectedItem.vote_average} / 10</p>
              
              <div style={{ marginBottom: '25px' }}>
                <h3 style={{ borderBottom: '2px solid #e50914', paddingBottom: '5px', display: 'inline-block', marginBottom: '10px' }}>Sinopsis</h3>
                <p style={{ fontSize: '16px', lineHeight: '1.6', color: '#ddd' }}>{selectedItem.overview || 'No hay sinopsis disponible en español.'}</p>
              </div>

              {itemTrailer && (
                <div style={{ marginBottom: '30px' }}>
                  <h3 style={{ borderBottom: '2px solid #e50914', paddingBottom: '5px', display: 'inline-block', marginBottom: '15px' }}>Tráiler Oficial</h3>
                  <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.8)', backgroundColor: '#000' }}>
                    <iframe src={`https://www.youtube.com/embed/${itemTrailer}`} title="Tráiler de YouTube" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>
                  </div>
                </div>
              )}

              {contentType === 'tv' && seasons.length > 0 && (
                <div style={{ marginBottom: '25px', backgroundColor: '#1a1a1a', padding: '15px', borderRadius: '8px', display: 'flex', gap: '20px', flexWrap: 'wrap', borderLeft: '4px solid #e50914' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#aaa', fontSize: '14px' }}>Temporada:</label>
                    <select value={selectedSeason} onChange={handleSeasonChange} style={{ padding: '8px 12px', borderRadius: '4px', backgroundColor: '#333', color: '#fff', border: '1px solid #444', cursor: 'pointer', fontSize: '15px' }}>
                      {seasons.map(s => (
                        <option key={s.id} value={s.season_number}>Temporada {s.season_number}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#aaa', fontSize: '14px' }}>Capítulo:</label>
                    <select value={selectedEpisode} onChange={(e) => setSelectedEpisode(parseInt(e.target.value))} style={{ padding: '8px 12px', borderRadius: '4px', backgroundColor: '#333', color: '#fff', border: '1px solid #444', cursor: 'pointer', fontSize: '15px' }}>
                      {episodes.map(ep => (
                        <option key={ep.id} value={ep.episode_number}>{ep.episode_number}. {ep.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div style={{ backgroundColor: '#1a1a1a', borderLeft: '4px solid #e50914', padding: '10px', marginBottom: '15px', borderRadius: '4px' }}>
                <p style={{ color: '#fff', fontSize: '13px', margin: 0 }}>
                  💡 <strong>Modo Estricto Latino:</strong> Esta plataforma usa un motor dedicado exclusivamente a bases de datos hispanas. Si el video no carga, significa que la película o capítulo aún no ha sido doblado o subido a la red latina.
                  <br/><br/>🛡️ Usa <strong>Brave Browser</strong> o <strong>uBlock Origin</strong> para una experiencia sin anuncios.
                </p>
              </div>

              <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.8)', backgroundColor: '#000' }}>
                <iframe src={getUnLimPlayUrl(contentType, selectedItem.id, selectedSeason, selectedEpisode)} title="Reproductor Principal" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>
              </div>

            </div>

            <div style={{ flex: 1, minWidth: '220px', textAlign: 'center' }}>
              {selectedItem.poster_path && <img src={`https://image.tmdb.org/t/p/w500${selectedItem.poster_path}`} alt={selectedItem.title} style={{ width: '100%', maxWidth: '280px', borderRadius: '8px', boxShadow: '0 4px 15px rgba(0,0,0,0.5)' }} />}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'catalog' && !selectedItem && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              
              {/* Controles de Películas y Series */}
              <div style={{ display: 'flex', backgroundColor: '#222', borderRadius: '6px', padding: '3px' }}>
                <button onClick={() => { setContentType('movie'); setPage(1); }} style={{ backgroundColor: contentType === 'movie' ? '#e50914' : 'transparent', color: '#fff', border: 'none', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Películas</button>
                <button onClick={() => { setContentType('tv'); setPage(1); }} style={{ backgroundColor: contentType === 'tv' ? '#e50914' : 'transparent', color: '#fff', border: 'none', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Series</button>
              </div>

              {/* Nuevos Controles de Populares y Estrenos */}
              <div style={{ display: 'flex', backgroundColor: '#222', borderRadius: '6px', padding: '3px' }}>
                <button onClick={() => { setListType('popular'); setPage(1); setSelectedGenre(''); setSearchTerm(''); }} style={{ backgroundColor: listType === 'popular' ? '#555' : 'transparent', color: '#fff', border: 'none', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>🔥 Populares</button>
                <button onClick={() => { setListType('latest'); setPage(1); setSelectedGenre(''); setSearchTerm(''); }} style={{ backgroundColor: listType === 'latest' ? '#555' : 'transparent', color: '#fff', border: 'none', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>✨ Estrenos</button>
              </div>

            </div>
            <input type="text" placeholder={contentType === 'movie' ? "Buscar películas..." : "Buscar series..."} value={searchTerm} onChange={(e) => handleSearchChange(e.target.value)} style={{ padding: '10px 15px', borderRadius: '4px', border: '1px solid #333', backgroundColor: '#222', color: '#fff', width: '250px', fontSize: '16px' }} />
          </div>

          <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '15px', marginBottom: '20px', whiteSpace: 'nowrap' }}>
            <button onClick={() => handleGenreChange('')} style={{ backgroundColor: selectedGenre === '' ? '#e50914' : '#222', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '20px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}>Todas</button>
            {genres.map(genre => (
              <button key={genre.id} onClick={() => handleGenreChange(genre.id)} style={{ backgroundColor: selectedGenre === genre.id ? '#e50914' : '#222', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '20px', cursor: 'pointer', fontSize: '14px' }}>{genre.name}</button>
            ))}
          </div>

          <p style={{ color: '#aaa' }}>Página {page} de {totalPages}</p>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px', marginTop: '20px' }}>
            {items.map(item => (
              <div key={item.id} onClick={() => handleSelectItem(item)} style={{ backgroundColor: '#1f1f1f', borderRadius: '8px', overflow: 'hidden', padding: '10px', textAlign: 'center', cursor: 'pointer', transition: 'transform 0.2s' }} onMouseOver={e => e.currentTarget.style.transform = 'scale(1.02)'} onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}>
                {item.poster_path ? <img src={`https://image.tmdb.org/t/p/w500${item.poster_path}`} alt={item.title} style={{ width: '100%', borderRadius: '4px' }} /> : <div style={{ height: '300px', backgroundColor: '#333' }}>Sin imagen</div>}
                <h3 style={{ fontSize: '15px', marginTop: '10px', height: '40px', overflow: 'hidden' }}>{item.title || item.name}</h3>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px', margin: '45px 0' }}>
            <button onClick={() => setPage(prev => Math.max(prev - 1, 1))} disabled={page === 1} style={{ backgroundColor: page === 1 ? '#333' : '#e50914', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: page === 1 ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>⬅ Anterior</button>
            <span style={{ fontSize: '16px', color: '#ddd' }}>Página <strong>{page}</strong> de {totalPages}</span>
            <button onClick={() => setPage(prev => Math.min(prev + 1, totalPages))} disabled={page === totalPages} style={{ backgroundColor: page === totalPages ? '#333' : '#e50914', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: page === totalPages ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>Siguiente ➡</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;