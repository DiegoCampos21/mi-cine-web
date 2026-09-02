import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';

function App() {
  const [activeTab, setActiveTab] = useState('catalog'); // 'catalog' o 'player'
  const [contentType, setContentType] = useState('movie'); // 'movie' o 'tv'
  const [items, setItems] = useState([]);
  const [genres, setGenres] = useState([]);
  const [selectedGenre, setSelectedGenre] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemTrailer, setItemTrailer] = useState(null);
  const [serverIndex, setServerIndex] = useState(0); 

  // Estados para el reproductor local/URL personalizada
  const [videoUrl, setVideoUrl] = useState('');
  const [customVideoSource, setCustomVideoSource] = useState('');
  const fileInputRef = useRef(null);
  
  const API_KEY = import.meta.env.VITE_TMDB_API_KEY;

  // Servidores agregadores con mayor probabilidad de tener pistas en Español Latino
  const servers = [
    { 
      name: 'Servidor 1 (SmashyStream - Multi-Opciones)', 
      getUrl: (type, id) => type === 'movie' 
        ? `https://embed.smashystream.com/playere.php?tmdb=${id}` 
        : `https://embed.smashystream.com/playere.php?tmdb=${id}&season=1&episode=1` 
    },
    { 
      name: 'Servidor 2 (VidLink - Selector de Audio)', 
      getUrl: (type, id) => type === 'movie' 
        ? `https://vidlink.pro/movie/${id}?primaryColor=e50914` 
        : `https://vidlink.pro/tv/${id}/1/1?primaryColor=e50914` 
    },
    { 
      name: 'Servidor 3 (2Embed - Global)', 
      getUrl: (type, id) => type === 'movie' 
        ? `https://www.2embed.cc/embed/${id}` 
        : `https://www.2embed.cc/embedtv/${id}&s=1&e=1` 
    }
  ];

  // 1. Cargar géneros y reiniciar página al cambiar de tipo
  useEffect(() => {
    if (activeTab === 'catalog') {
      setSelectedGenre('');
      setSearchTerm('');
      setPage(1);
      axios.get(`https://api.themoviedb.org/3/genre/${contentType}/list?api_key=${API_KEY}&language=es-MX`)
        .then(response => setGenres(response.data.genres))
        .catch(error => console.error("Error al cargar géneros:", error));
    }
  }, [contentType, activeTab]);

  // 2. Cargar contenido del catálogo
  useEffect(() => {
    if (activeTab !== 'catalog') return;

    let url = '';
    if (searchTerm.trim() !== '') {
      url = `https://api.themoviedb.org/3/search/${contentType}?api_key=${API_KEY}&language=es-MX&query=${searchTerm}&page=${page}`;
    } else if (selectedGenre !== '') {
      url = `https://api.themoviedb.org/3/discover/${contentType}?api_key=${API_KEY}&language=es-MX&with_genres=${selectedGenre}&page=${page}`;
    } else {
      url = `https://api.themoviedb.org/3/${contentType}/popular?api_key=${API_KEY}&language=es-MX&page=${page}`;
    }

    axios.get(url)
      .then(response => {
        setItems(response.data.results);
        setTotalPages(response.data.total_pages > 500 ? 500 : response.data.total_pages);
      })
      .catch(error => console.error("Error al cargar datos:", error));
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [searchTerm, selectedGenre, contentType, page, activeTab]);

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

  const handleSelectItem = (item) => {
    setSelectedItem(item);
    setItemTrailer(null);
    setServerIndex(0); // Empezar siempre con el Servidor 1

    // Buscar tráiler oficial en YouTube
    axios.get(`https://api.themoviedb.org/3/${contentType}/${item.id}/videos?api_key=${API_KEY}&language=es-MX`)
      .then(response => {
        const videos = response.data.results;
        const trailer = videos.find(v => v.type === 'Trailer' && v.site === 'YouTube');
        if (trailer) {
          setItemTrailer(trailer.key);
        } else if (videos.length > 0) {
          const fallbackTrailer = videos.find(v => v.site === 'YouTube');
          if (fallbackTrailer) setItemTrailer(fallbackTrailer.key);
        }
      })
      .catch(error => console.error("Error al buscar el tráiler:", error));
  };

  // Manejar archivo local
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const localUrl = URL.createObjectURL(file);
      setCustomVideoSource(localUrl);
    }
  };

  const handleUrlSubmit = (e) => {
    e.preventDefault();
    if (videoUrl.trim() !== '') {
      setCustomVideoSource(videoUrl.trim());
    }
  };

  return (
    <div style={{ backgroundColor: '#141414', color: '#fff', minHeight: '100vh', padding: '20px', fontFamily: 'sans-serif' }}>
      
      {/* Navegación */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333', paddingBottom: '15px', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
        <h1 style={{ margin: 0, color: '#e50914', cursor: 'pointer' }} onClick={() => { setActiveTab('catalog'); setSelectedItem(null); }}>
          🎬 Mi Cine Latino
        </h1>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={() => { setActiveTab('catalog'); setSelectedItem(null); }}
            style={{ backgroundColor: activeTab === 'catalog' ? '#e50914' : '#222', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Películas y Series
          </button>
          <button 
            onClick={() => setActiveTab('player')}
            style={{ backgroundColor: activeTab === 'player' ? '#e50914' : '#222', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            📁 Local / URL
          </button>
        </div>
      </div>

      {/* VISTA 1: REPRODUCTOR LOCAL */}
      {activeTab === 'player' && (
        <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center', paddingBottom: '40px' }}>
          <h2 style={{ marginBottom: '10px' }}>Reproductor Multimedia Personal</h2>
          <p style={{ color: '#aaa', marginBottom: '30px' }}>Sube tus videos locales o introduce un enlace directo compatible.</p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '30px', flexWrap: 'wrap' }}>
            <div>
              <input type="file" accept="video/*" ref={fileInputRef} onChange={handleFileUpload} style={{ display: 'none' }} />
              <button onClick={() => fileInputRef.current.click()} style={{ backgroundColor: '#333', color: '#fff', border: '1px solid #555', padding: '12px 20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                📂 Seleccionar archivo multimedia
              </button>
            </div>
            <form onSubmit={handleUrlSubmit} style={{ display: 'flex', gap: '10px' }}>
              <input type="url" placeholder="https://ejemplo.com/video.mp4" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} style={{ padding: '10px 15px', borderRadius: '4px', border: '1px solid #333', backgroundColor: '#222', color: '#fff', width: '280px', fontSize: '14px' }} />
              <button type="submit" style={{ backgroundColor: '#e50914', color: '#fff', border: 'none', padding: '10px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Cargar URL</button>
            </form>
          </div>

          {customVideoSource ? (
            <div style={{ backgroundColor: '#000', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.8)' }}>
              <video src={customVideoSource} controls autoPlay style={{ width: '100%', maxHeight: '500px', display: 'block' }}>Tu navegador no soporta video.</video>
            </div>
          ) : (
            <div style={{ border: '2px dashed #444', borderRadius: '8px', padding: '60px 20px', color: '#666' }}>
              <p style={{ fontSize: '18px' }}>Ningún video seleccionado o cargado todavía.</p>
            </div>
          )}
        </div>
      )}

      {/* VISTA 2: DETALLE Y REPRODUCTOR IFRAME LATINO */}
      {activeTab === 'catalog' && selectedItem && (
        <div>
          <button 
            onClick={() => setSelectedItem(null)}
            style={{ backgroundColor: '#333', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer', fontSize: '16px', marginBottom: '20px', fontWeight: 'bold' }}
          >
            ⬅ Volver al catálogo
          </button>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '40px', marginTop: '10px', alignItems: 'flex-start' }}>
            
            <div style={{ flex: 2, minWidth: '300px', maxWidth: '800px' }}>
              <h2 style={{ fontSize: '28px', marginBottom: '15px' }}>▶ Reproduciendo: {selectedItem.title || selectedItem.name}</h2>
              
              {/* Aviso Navegador */}
              <div style={{ backgroundColor: '#1a1a1a', borderLeft: '4px solid #e50914', padding: '10px', marginBottom: '15px', borderRadius: '4px' }}>
                <p style={{ color: '#fff', fontSize: '13px', margin: 0 }}>
                  🛡️ <strong>Aviso:</strong> Para una experiencia sin interrupciones ni ventanas emergentes, sugerimos usar el navegador <strong>Brave</strong> o instalar <strong>uBlock Origin</strong>. 
                  <br/><br/>
                  💡 <strong>Tip de Idioma:</strong> Si el Servidor 1 está en inglés, busca sus controles internos para cambiar de reproductor, o usa el <strong>Servidor 2 (VidLink)</strong> y revisa la tuerca ⚙️ de audio.
                </p>
              </div>

              {/* Selector de Servidores */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px', flexWrap: 'wrap' }}>
                {servers.map((srv, idx) => (
                  <button 
                    key={idx}
                    onClick={() => setServerIndex(idx)}
                    style={{ 
                      backgroundColor: serverIndex === idx ? '#e50914' : '#222', 
                      color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '4px', 
                      cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' 
                    }}
                  >
                    {srv.name}
                  </button>
                ))}
              </div>

              {/* Contenedor del Iframe */}
              <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.8)', backgroundColor: '#000' }}>
                <iframe 
                  key={serverIndex}
                  src={servers[serverIndex].getUrl(contentType, selectedItem.id)} 
                  title="Reproductor de streaming" 
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                  allowFullScreen
                ></iframe>
              </div>

              {itemTrailer && (
                <div style={{ marginTop: '15px' }}>
                  <a href={`https://www.youtube.com/watch?v=${itemTrailer}`} target="_blank" rel="noopener noreferrer" style={{ color: '#e50914', textDecoration: 'none', fontWeight: 'bold', fontSize: '14px' }}>🎬 Ver tráiler oficial en YouTube</a>
                </div>
              )}

              <div style={{ marginTop: '20px' }}>
                <p style={{ color: '#aaa', fontSize: '14px', marginBottom: '15px' }}>
                  📅 Estreno: {selectedItem.release_date || selectedItem.first_air_date || 'Desconocida'} | ⭐ Calificación: {selectedItem.vote_average} / 10
                </p>
                <h3 style={{ borderBottom: '2px solid #e50914', paddingBottom: '5px', display: 'inline-block', marginBottom: '10px' }}>Sinopsis</h3>
                <p style={{ fontSize: '16px', lineHeight: '1.6', color: '#ddd' }}>
                  {selectedItem.overview || 'No hay sinopsis disponible en español.'}
                </p>
              </div>
            </div>

            {/* Póster */}
            <div style={{ flex: 1, minWidth: '220px', textAlign: 'center' }}>
              {selectedItem.poster_path && (
                <img src={`https://image.tmdb.org/t/p/w500${selectedItem.poster_path}`} alt={selectedItem.title || selectedItem.name} style={{ width: '100%', maxWidth: '280px', borderRadius: '8px', boxShadow: '0 4px 15px rgba(0,0,0,0.5)' }} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* VISTA 3: CATÁLOGO PRINCIPAL */}
      {activeTab === 'catalog' && !selectedItem && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ display: 'flex', backgroundColor: '#222', borderRadius: '6px', padding: '3px' }}>
                <button onClick={() => setContentType('movie')} style={{ backgroundColor: contentType === 'movie' ? '#e50914' : 'transparent', color: '#fff', border: 'none', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Películas</button>
                <button onClick={() => setContentType('tv')} style={{ backgroundColor: contentType === 'tv' ? '#e50914' : 'transparent', color: '#fff', border: 'none', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Series</button>
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

          <p style={{ color: '#aaa' }}>{searchTerm ? `Resultados para: "${searchTerm}"` : selectedGenre ? 'Contenido filtrado por género' : `Catálogo popular de ${contentType === 'movie' ? 'Películas' : 'Series'}`} (Página {page} de {totalPages}):</p>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px', marginTop: '20px' }}>
            {items.map(item => {
              const itemTitle = item.title || item.name;
              return (
                <div key={item.id} onClick={() => handleSelectItem(item)} style={{ backgroundColor: '#1f1f1f', borderRadius: '8px', overflow: 'hidden', padding: '10px', textAlign: 'center', cursor: 'pointer', transition: 'transform 0.2s' }}>
                  {item.poster_path ? <img src={`https://image.tmdb.org/t/p/w500${item.poster_path}`} alt={itemTitle} style={{ width: '100%', borderRadius: '4px' }} /> : <div style={{ height: '300px', backgroundColor: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#777' }}>Sin imagen</div>}
                  <h3 style={{ fontSize: '15px', marginTop: '10px', height: '40px', overflow: 'hidden' }}>{itemTitle}</h3>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px', margin: '45px 0' }}>
            <button onClick={() => setPage(prev => Math.max(prev - 1, 1))} disabled={page === 1} style={{ backgroundColor: page === 1 ? '#333' : '#e50914', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: page === 1 ? 'not-allowed' : 'pointer', fontSize: '15px', fontWeight: 'bold' }}>⬅ Anterior</button>
            <span style={{ fontSize: '16px', color: '#ddd' }}>Página <strong>{page}</strong> de {totalPages}</span>
            <button onClick={() => setPage(prev => Math.min(prev + 1, totalPages))} disabled={page === totalPages} style={{ backgroundColor: page === totalPages ? '#333' : '#e50914', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: page === totalPages ? 'not-allowed' : 'pointer', fontSize: '15px', fontWeight: 'bold' }}>Siguiente ➡</button>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;