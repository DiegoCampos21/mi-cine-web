import React, { useEffect, useState } from 'react';
import axios from 'axios';

function App() {
  const [contentType, setContentType] = useState('movie'); // 'movie' o 'tv'
  const [items, setItems] = useState([]);
  const [genres, setGenres] = useState([]);
  const [selectedGenre, setSelectedGenre] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemTrailer, setItemTrailer] = useState(null);
  
  const API_KEY = import.meta.env.VITE_TMDB_API_KEY;

  // 1. Cargar géneros y reiniciar página al cambiar de tipo
  useEffect(() => {
    setSelectedGenre('');
    setSearchTerm('');
    setPage(1);
    axios.get(`https://api.themoviedb.org/3/genre/${contentType}/list?api_key=${API_KEY}&language=es-MX`)
      .then(response => setGenres(response.data.genres))
      .catch(error => console.error("Error al cargar géneros:", error));
  }, [contentType]);

  // 2. Cargar contenido basado en la página exacta seleccionada
  useEffect(() => {
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
        // TMDB limita a veces las páginas a un máximo de 500 para evitar desbordamientos
        setTotalPages(response.data.total_pages > 500 ? 500 : response.data.total_pages);
      })
      .catch(error => console.error("Error al cargar datos:", error));
    
    // Subir la ventana al cambiar de página para mejor comodidad visual
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [searchTerm, selectedGenre, contentType, page]);

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

  // Vista de detalle
  if (selectedItem) {
    const title = selectedItem.title || selectedItem.name;
    const releaseDate = selectedItem.release_date || selectedItem.first_air_date;

    return (
      <div style={{ backgroundColor: '#141414', color: '#fff', minHeight: '100vh', padding: '30px', fontFamily: 'sans-serif' }}>
        <button 
          onClick={() => setSelectedItem(null)}
          style={{ backgroundColor: '#e50914', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer', fontSize: '16px', marginBottom: '20px' }}
        >
          ⬅ Volver al catálogo
        </button>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '40px', marginTop: '20px', alignItems: 'flex-start' }}>
          {selectedItem.poster_path && (
            <img 
              src={`https://image.tmdb.org/t/p/w500${selectedItem.poster_path}`} 
              alt={title} 
              style={{ width: '300px', borderRadius: '8px', boxShadow: '0 4px 15px rgba(0,0,0,0.5)' }}
            />
          )}
          <div style={{ flex: 1, maxWidth: '600px' }}>
            <h1 style={{ fontSize: '36px', marginBottom: '10px' }}>{title}</h1>
            <p style={{ color: '#aaa', fontSize: '14px', marginBottom: '20px' }}>
              📅 Estreno: {releaseDate || 'Desconocida'} | ⭐ Calificación: {selectedItem.vote_average} / 10
            </p>
            <h3 style={{ borderBottom: '2px solid #e50914', paddingBottom: '5px', display: 'inline-block' }}>Sinopsis</h3>
            <p style={{ fontSize: '16px', lineHeight: '1.6', color: '#ddd', marginTop: '10px', marginBottom: '30px' }}>
              {selectedItem.overview || 'No hay sinopsis disponible en español.'}
            </p>

            <h3 style={{ borderBottom: '2px solid #e50914', paddingBottom: '5px', display: 'inline-block', marginBottom: '15px' }}>Tráiler Oficial</h3>
            {itemTrailer ? (
              <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: '8px', boxShadow: '0 4px 15px rgba(0,0,0,0.5)' }}>
                <iframe 
                  src={`https://www.youtube.com/embed/${itemTrailer}`} 
                  title="Tráiler oficial" 
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                  allowFullScreen
                ></iframe>
              </div>
            ) : (
              <p style={{ color: '#777', fontStyle: 'italic' }}>No hay tráiler disponible en YouTube.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Vista principal del catálogo
  return (
    <div style={{ backgroundColor: '#141414', color: '#fff', minHeight: '100vh', padding: '20px', fontFamily: 'sans-serif' }}>
      
      {/* Cabecera, Pestañas y Buscador */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <h1 style={{ margin: 0, color: '#fff' }}>🎬 Mi Plataforma de Cine</h1>
          
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
        {searchTerm ? `Resultados para: "${searchTerm}"` : selectedGenre ? 'Contenido filtrado por género' : `Catálogo popular de ${contentType === 'movie' ? 'Películas' : 'Series'} en Español Latino`} (Página {page} de {totalPages}):
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
  );
}

export default App;