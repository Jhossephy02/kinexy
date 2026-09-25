import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { commentsService } from '../../api/client';

export default function PostComments({ post, isAuthenticated }) {
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { if (post?.id) commentsService.list(post.id).then(result => setComments(result.comments || [])).catch(() => setComments([])); }, [post?.id]);
  async function submit(event) { event.preventDefault(); if (!text.trim()) return; setError(''); try { const result = await commentsService.create(post.id, text); setComments(items => [...items, result.comment]); setText(''); } catch (err) { setError(err.message); } }
  if (!post) return null;
  return <section className="post-comments" aria-label="Comentarios de la publicación"><header><h3>Comentarios</h3><span>{comments.length}</span></header>{comments.length ? comments.map(comment => <p key={comment.id}><strong>{comment.author}</strong><span>{comment.text}</span></p>) : <p className="post-comments-empty">Sé la primera persona en comentar.</p>}{isAuthenticated ? <form onSubmit={submit}><input value={text} onChange={event => setText(event.target.value)} maxLength={1000} placeholder="Escribe un comentario…"/><button type="submit">Publicar</button></form> : <Link to="/login">Inicia sesión para comentar</Link>}{error && <small role="alert">{error}</small>}</section>;
}
