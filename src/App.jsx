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

  // Estados para el reproductor con pistas personalizables de subtítulos y video
  const [videoSource, setVideoSource] = useState('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4');
  const [customVideoInput, setCustomVideoInput] = useState('');
  
  // URLs de pistas de subtítulos dinámicas
  const [subtitles, setSubtitles] = useState({
    es: 'https://raw.githubusercontent.com/andris9/subtitles-parser/master/test/fixtures/subtitles.vtt',
    en: ''
  });
  const [customSubEs, setCustomSubEs] = useState('');
  const [customSubEn, setCustomSubEn] = useState('');

  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const subtitleFileInputRef = useRef(null);
  
  const API_KEY = import.meta.env.VITE_TMDB_API_KEY;

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

  // 2. Cargar contenido basado en la página exacta seleccionada
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

    // Buscar tráiler oficial en YouTube como respaldo de video limpio
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

  // Manejadores de archivos locales y subtítulos
  const handleVideoFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const localUrl = URL.createObjectURL(file);
      setVideoSource(localUrl);
    }
  };

  const handleSubtitleFileUpload = (e, lang) => {
    const file = e.target.files[0];
    if (file) {
      const localUrl = URL.createObjectURL(file);
      setSubtitles(prev => ({ ...prev, [lang]: localUrl }));
    }
  };

  const handleCustomVideoSubmit = (e) => {
    e.preventDefault();
    if (customVideoInput.trim() !== '') {
      setVideoSource(customVideoInput.trim());
    }
  };

  const handleSubSubmit = (e, lang) => {
    e.preventDefault();
    const url = lang === 'es' ? customSubEs : customSubEn;
    if (url.trim() !== '') {
      setSubtitles(prev => ({ ...prev, [lang]: url.trim() }));
    }
  };

  return (
    <div style={{ backgroundColor: '#141414', color: '#fff', minHeight: '100vh', padding: '20px', fontFamily: 'sans-serif' }}>
      
      {/* Barra de Navegación Superior Global */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333', paddingBottom: '15px', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
        <h1 style={{ margin: 0, color: '#e50914', cursor: 'pointer' }} onClick={() => { setActiveTab('catalog'); setSelectedItem(null); }}>
          🎬 Mi Plataforma Pro con Pistas Personalizadas
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
            ⚙️ Gestor de Pistas y Subtítulos
          </button>
        </div>
      </div>

      {/* VISTA 1: GESTOR DE FUENTES Y SUBTÍTULOS */}
      {activeTab === 'player' && (
        <div style={{ maxWidth: '900px', margin: '0 auto', paddingBottom: '40px' }}>
          <h2 style={{ marginBottom: '10px', textAlign: 'center' }}>Configuración del Reproductor de Pistas</h2>
          <p style={{ color: '#aaa', marginBottom: '30px', textAlign: 'center' }}>Carga archivos de video y subtítulos externos (.vtt) para controlar el idioma a voluntad sin anuncios.</p>

          {/* Sección Video */}
          <div style={{ backgroundColor: '#1f1f1f', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
            <h3 style={{ marginBottom: '10px', color: '#e50914' }}>1. Fuente de Video</h3>
            <div style={{ display: 'flex', gap: '15px', marginBottom: '15px', flexWrap: 'wrap' }}>
              <input type="file" accept="video/*" ref={fileInputRef} onChange={handleVideoFileUpload} style={{ display: 'none' }} />
              <button onClick={() => fileInputRef.current.click()} style={{ backgroundColor: '#333', color: '#fff', border: '1px solid #555', padding: '10px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                📂 Subir video local (.mp4)
              </button>
            </div>
            <form onSubmit={handleCustomVideoSubmit} style={{ display: 'flex', gap: '10px' }}>
              <input 
                type="url" 
                placeholder="O pega enlace directo de video (ej. MP4 / GDrive directo)" 
                value={customVideoInput} 
                onChange={(e) => setCustomVideoInput(e.target.value)}
                style={{ flex: 1, padding: '10px', borderRadius: '4px', border: '1px solid #333', backgroundColor: '#222', color: '#fff' }}
              />
              <button type="submit" style={{ backgroundColor: '#e50914', color: '#fff', border: 'none', padding: '10px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                Cargar Video
              </button>
            </form>
          </div>

          {/* Sección Subtítulos Español */}
          <div style={{ backgroundColor: '#1f1f1f', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
            <h3 style={{ marginBottom: '10px', color: '#e50914' }}>2. Pista de Subtítulos en Español (.vtt)</h3>
            <form onSubmit={(e) => handleSubSubmit(e, 'es')} style={{ display: 'flex', gap: '10px' }}>
              <input 
                type="url" 
                placeholder="Enlace URL de subtítulo .vtt en español" 
                value={customSubEs} 
                onChange={(e) => setCustomSubEs(e.target.value)}
                style={{ flex: 1, padding: '10px', borderRadius: '4px', border: '1px solid #333', backgroundColor: '#222', color: '#fff' }}
              />
              <button type="submit" style={{ backgroundColor: '#e50914', color: '#fff', border: 'none', padding: '10px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                Aplicar Subtítulo ES
              </button>
            </form>
          </div>

          {/* Reproductor de Prueba */}
          <div style={{ backgroundColor: '#000', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.8)' }}>
            <video 
              ref={videoRef}
              src={videoSource} 
              controls 
              playsInline
              style={{ width: '100%', maxHeight: '450px', display: 'block' }}
            >
              {subtitles.es && <track kind="subtitles" src={subtitles.es} srcLang="es" label="Español" default />}
              {subtitles.en && <track kind="subtitles" src={subtitles.en} srcLang="en" label="English" />}
              Tu navegador no soporta video HTML5.
            </video>
          </div>
        </div>
      )}

      {/* VISTA 2: DETALLE Y REPRODUCTOR NATIVO DE LA PELÍCULA DE TMDB */}
      {activeTab === 'catalog' && selectedItem && (
        <div>
          <button 
            onClick={() => setSelectedItem(null)}
            style={{ backgroundColor: '#333', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer', fontSize: '16px', marginBottom: '20px', fontWeight: 'bold' }}
          >
            ⬅ Volver al catálogo
          </button>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '40px', marginTop: '10px', alignItems: 'flex-start' }}>
            
            {/* Columna Izquierda: Reproductor HTML5 con control de pistas integradas */}
            <div style={{ flex: 2, minWidth: '300px', maxWidth: '800px' }}>
              <h2 style={{ fontSize: '28px', marginBottom: '15px' }}>▶ Reproduciendo: {selectedItem.title || selectedItem.name}</h2>
              
              <div style={{ backgroundColor: '#1f1f1f', padding: '12px 15px', borderRadius: '6px', marginBottom: '15px', fontSize: '13px', color: '#aaa' }}>
                💡 <em>Este reproductor nativo no tiene anuncios. Puedes configurar tus propias fuentes y archivos `.vtt` de subtítulos desde la pestaña superior de configuración si la película requiere un idioma específico.</em>
              </div>

              {/* Contenedor del video HTML5 nativo limpio */}
              <div style={{ backgroundColor: '#000', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.8)' }}>
                <video 
                  controls 
                  autoPlay
                  playsInline
                  style={{ width: '100%', maxHeight: '500px', display: 'block' }}
                >
                  <source src={videoSource} type="video/mp4" />
                  {subtitles.es && <track kind="subtitles" src={subtitles.es} srcLang="es" label="Español" default />}
                  {subtitles.en && <track kind="subtitles" src={subtitles.en} srcLang="en" label="English" />}
                  Tu navegador no soporta la etiqueta de video.
                </video>
              </div>

              {/* Enlace alternativo de tráiler */}
              {itemTrailer && (
                <div style={{ marginTop: '15px' }}>
                  <a 
                    href={`https://www.youtube.com/watch?v=${itemTrailer}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ color: '#e50914', textDecoration: 'none', fontWeight: 'bold', fontSize: '14px' }}
                  >
                    🎬 Ver tráiler oficial en YouTube
                  </a>
                </div>
              )}

              {/* Información y Sinopsis */}
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

            {/* Columna Derecha: Póster */}
            <div style={{ flex: 1, minWidth: '220px', textAlign: 'center' }}>
              {selectedItem.poster_path && (
                <img 
                  src={`https://image.tmdb.org/t/p/w500${selectedItem.poster_path}`} 
                  alt={selectedItem.title || selectedItem.name} 
                  style={{ width: '100%', maxWidth: '280px', borderRadius: '8px', boxShadow: '0 4px 15px rgba(0,0,0,0.5)' }}
                />
              )}
            </div>

          </div>
        </div>
      )}

      {/* VISTA 3: CATÁLOGO PRINCIPAL (PELÍCULAS / SERIES) */}
      {activeTab === 'catalog' && !selectedItem && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ display: 'flex', backgroundColor: '#222', borderRadius: '6px', padding: '3px' }}>
                <button 
                  onClick={() => setContentType('movie')}
                  style={{ backgroundColor: contentType === 'movie' ? '#e50914' : 'transparent', color: '#fff', border: 'none', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  Películas
                </button>
                <button 
                  onClick={() => setContentType('tv')}
                  style={{ backgroundColor: contentType === 'tv' ? '#e50914' : 'transparent', color: '#fff', border: 'none', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  Series
                </button>
              </div>
            </div>
            
            <input 
              type="text" 
              placeholder={contentType === 'movie' ? "Buscar películas..." : "Buscar series..."} 
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              style={{ padding: '10px 15px', borderRadius: '4px', border: '1px solid #333', backgroundColor: '#222', color: '#fff', width: '250px', fontSize: '16px' }}
            />
          </div>

          {/* Barra de Filtros por Género */}
          <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '15px', marginBottom: '20px', whiteSpace: 'nowrap' }}>
            <button 
              onClick={() => handleGenreChange('')}
              style={{ 
                backgroundColor: selectedGenre === '' ? '#e50914' : '#222', 
                color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '20px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' 
              }}
            >
              Todas
            </button>
            {genres.map(genre => (
              <button 
                key={genre.id}
                onClick={() => handleGenreChange(genre.id)}
                style={{ 
                  backgroundColor: selectedGenre === genre.id ? '#e50914' : '#222', 
                  color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '20px', cursor: 'pointer', fontSize: '14px' 
                }}
              >
                {genre.name}
              </button>
            ))}
          </div>

          <p style={{ color: '#aaa' }}>
            {searchTerm ? `Resultados para: "${searchTerm}"` : selectedGenre ? 'Contenido filtrado por género' : `Catálogo popular de ${contentType === 'movie' ? 'Películas' : 'Series'}`} (Página {page} de {totalPages}):
          </p>
          
          {/* Cuadrícula de elementos */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px', marginTop: '20px' }}>
            {items.map(item => {
              const itemTitle = item.title || item.name;
              return (
                <div 
                  key={item.id} 
                  onClick={() => handleSelectItem(item)}
                  style={{ backgroundColor: '#1f1f1f', borderRadius: '8px', overflow: 'hidden', padding: '10px', textAlign: 'center', cursor: 'pointer', transition: 'transform 0.2s' }}
                >
                  {item.poster_path ? (
                    <img 
                      src={`https://image.tmdb.org/t/p/w500${item.poster_path}`} 
                      alt={itemTitle} 
                      style={{ width: '100%', borderRadius: '4px' }}
                    />
                  ) : (
                    <div style={{ height: '300px', backgroundColor: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#777' }}>Sin imagen</div>
                  )}
                  <h3 style={{ fontSize: '15px', marginTop: '10px', height: '40px', overflow: 'hidden' }}>{itemTitle}</h3>
                </div>
              );
            })}
          </div>

          {/* Controles de Paginación */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px', margin: '45px 0' }}>
            <button 
              onClick={() => setPage(prev => Math.max(prev - 1, 1))}
              disabled={page === 1}
              style={{ 
                backgroundColor: page === 1 ? '#333' : '#e50914', 
                color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '4px', 
                cursor: page === 1 ? 'not-allowed' : 'pointer', fontSize: '15px', fontWeight: 'bold' 
              }}
            >
              ⬅ Anterior
            </button>

            <span style={{ fontSize: '16px', color: '#ddd' }}>
              Página <strong>{page}</strong> de {totalPages}
            </span>

            <button 
              onClick={() => setPage(prev => Math.min(prev + 1, totalPages))}
              disabled={page === totalPages}
              style={{ 
                backgroundColor: page === totalPages ? '#333' : '#e50914', 
                color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '4px', 
                cursor: page === totalPages ? 'not-allowed' : 'pointer', fontSize: '15px', fontWeight: 'bold' 
              }}
            >
              Siguiente ➡
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;