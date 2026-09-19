import React, { useState, useEffect } from 'react';
import { appClient } from '@/api/appClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Heart, MessageCircle, Trash2, Edit2, ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';

export default function PostCard({ post, user, avatarUrl, onEdit, onDelete }) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [liked, setLiked] = useState(false);
  const queryClient = useQueryClient();

  // Fetch comments
  const { data: comments = [] } = useQuery({
    queryKey: ['postComments', post.id],
    queryFn: async () => (await appClient.functions.invoke('managePostComment', { action: 'filter', filters: { post_id: post.id } })).data.items,
  });

  // Fetch likes
  const { data: likes = [] } = useQuery({
    queryKey: ['postLikes', post.id],
    queryFn: async () => (await appClient.functions.invoke('managePostLike', { action: 'filter', filters: { post_id: post.id } })).data.items,
  });

  // Check if current user liked
  React.useEffect(() => {
    if (user) {
      setLiked(likes.some(l => l.user_email === user.email));
    }
  }, [likes, user]);

  // Add comment mutation
  const addCommentMutation = useMutation({
    mutationFn: (content) =>
      appClient.functions.invoke('managePostComment', {
        action: 'save',
        post_id: post.id,
        author_email: user.email,
        author_name: user.full_name,
        content,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['postComments'] });
      setCommentText('');
    },
  });

  // Toggle like mutation
  const toggleLikeMutation = useMutation({
    mutationFn: async () => {
      const existingLike = likes.find(l => l.user_email === user.email);
      if (existingLike) {
        await appClient.functions.invoke('managePostLike', { action: 'delete', id: existingLike.id });
      } else {
        await appClient.functions.invoke('managePostLike', {
          action: 'save',
          post_id: post.id,
          user_email: user.email,
          user_name: user.full_name,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['postLikes'] });
    },
  });

  const handleAddComment = () => {
    if (!commentText.trim()) return;
    addCommentMutation.mutate(commentText);
  };

  const isOwner = user && post.member_email === user.email;
  const imageCount = post.images?.length || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-neutral-950 via-neutral-950 to-red-950/30 border-l-4 border-l-red-600 border-y border-r border-white/10 rounded-md overflow-hidden hover:border-l-red-500 hover:shadow-[0_0_20px_rgba(239,68,68,0.25)] transition-all duration-200"
    >
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={post.member_name}
              className="w-12 h-12 rounded-full object-cover flex-shrink-0 border-2 border-red-600 shadow-[0_0_10px_rgba(239,68,68,0.4)]"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center flex-shrink-0 border-2 border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.4)]">
              <span className="text-white text-base font-black">
                {(post.member_name || '?').charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div className="min-w-0">
            <h3 className="text-white font-black text-lg sm:text-xl tracking-tight truncate uppercase">{post.title}</h3>
            <p className="text-red-500 text-xs mt-0.5 font-bold tracking-wide">{post.member_name}</p>
          </div>
        </div>
        {isOwner && (
          <div className="flex gap-2">
            <button
              onClick={onEdit}
              className="text-white hover:text-white transition-colors"
            >
              <Edit2 size={16} />
            </button>
            <button
              onClick={onDelete}
              className="text-red-500 hover:text-red-500 transition-colors"
            >
              <Trash2 size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Images Gallery */}
      {imageCount > 0 && (
        <div className={imageCount === 1 ? 'w-full bg-black' : 'grid grid-cols-2 gap-1 bg-black'}>
          {post.images.map((img, idx) => (
            <img
              key={idx}
              src={img}
              alt={`post-${idx}`}
              className={imageCount === 1
                ? 'block w-full max-h-[520px] object-contain'
                : imageCount === 3 && idx === 0
                  ? 'col-span-2 block w-full h-48 sm:h-72 object-cover'
                : 'block w-full h-40 sm:h-56 object-cover'
              }
            />
          ))}
        </div>
      )}

      {/* Description */}
      <div className="p-4 border-b border-white/10">
        <p className="text-white text-sm leading-relaxed">{post.description}</p>
      </div>

      {/* Links */}
      {post.links && post.links.length > 0 && (
        <div className="p-4 border-b border-white/10 space-y-2">
          {post.links.map((link, idx) => (
            <a
              key={idx}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-red-500 hover:text-red-600 text-sm underline transition-colors"
            >
              {link.text}
            </a>
          ))}
        </div>
      )}

      {/* Engagement */}
      <div className="px-4 py-3 flex items-center gap-6 border-b border-white/10 bg-black/30">
        <button
          onClick={() => user && toggleLikeMutation.mutate()}
          disabled={!user}
          className={`flex items-center gap-2 transition-all disabled:opacity-50 ${
            liked ? 'text-red-500 scale-110' : 'text-white hover:text-red-500'
          }`}
        >
          <Heart size={18} fill={liked ? 'currentColor' : 'none'} className={liked ? 'drop-shadow-[0_0_6px_rgba(239,68,68,0.6)]' : ''} />
          <span className="text-xs font-semibold">{likes.length}</span>
        </button>
        <button
          onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-2 text-white hover:text-red-500 transition-colors"
        >
          <MessageCircle size={18} />
          <span className="text-xs font-semibold">{comments.length}</span>
        </button>
      </div>

      {/* Comments Section - Auto-expanded */}
      {(showComments || comments.length > 0) && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="border-t border-white/10 p-4 space-y-4"
        >
          {/* Comment Input */}
          {user ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
                placeholder="Add a comment..."
                className="flex-1 bg-neutral-800 border border-white/20 text-white text-xs px-3 py-2 rounded-sm placeholder:text-white focus:outline-none focus:border-white/40"
              />
              <button
                onClick={handleAddComment}
                disabled={addCommentMutation.isPending || !commentText.trim()}
                className="bg-red-600 text-white px-3 py-2 rounded-sm hover:bg-red-700 transition-colors text-xs disabled:opacity-50"
              >
                Post
              </button>
            </div>
          ) : (
            <p className="text-white text-xs text-center py-1">Connectez-vous pour commenter</p>
          )}

          {/* Comments List */}
          <div className="space-y-3 max-h-48 overflow-y-auto">
            {comments.map((comment) => (
              <div key={comment.id} className="bg-neutral-900 rounded-sm p-3">
                <p className="text-white text-xs font-light">
                  <span className="font-semibold">{comment.author_name}</span>
                </p>
                <p className="text-white text-xs mt-1">{comment.content}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
