import React, { useState } from 'react';
import { appClient } from '@/api/appClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import PostCard from '@/components/PostCard';
import PostComposer from '@/components/posts/PostComposer';

export default function PostFeed() {
  const { user } = useAuth();
  const [editingPost, setEditingPost] = useState(null);
  const queryClient = useQueryClient();

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['memberPosts'],
    queryFn: async () => (await appClient.functions.invoke('manageMemberPost', {
      action: 'list',
      sort: '-created_date',
    })).data.items,
    staleTime: 30 * 1000,
  });

  // Fetch member profiles to map email -> avatar_url
  const { data: profiles = [] } = useQuery({
    queryKey: ['memberProfilesForFeed'],
    queryFn: async () => (await appClient.functions.invoke('manageMemberProfile', { action: 'list' })).data.items,
    staleTime: 60 * 1000,
  });
  const avatarMap = {};
  (profiles || []).forEach(p => {
    if (p.user_email) avatarMap[p.user_email] = p.avatar_url || (p.images && p.images[0]) || '';
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => appClient.functions.invoke('manageMemberPost', { action: 'delete', id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['memberPosts'] }),
  });

  const handleEdit = (post) => setEditingPost(post);
  const handleDelete = (post) => {
    if (confirm('Supprimer ce post ?')) deleteMutation.mutate(post.id);
  };
  const handleDone = () => setEditingPost(null);

  return (
    <div className="w-full px-4 mb-8">
      <div className="flex items-center gap-3 mb-6">
        <span className="w-2 h-9 bg-red-600 rounded-full shadow-[0_0_12px_rgba(239,68,68,0.6)]" />
        <h2 className="text-white text-2xl sm:text-3xl font-black tracking-tight uppercase drop-shadow-[0_2px_8px_rgba(239,68,68,0.3)]">Fil de la communauté</h2>
        <div className="flex-1 h-0.5 bg-gradient-to-r from-red-600 via-red-600/30 to-transparent" />
      </div>

      {/* Composer for logged-in members */}
      {user && (
        <PostComposer user={user} editingPost={editingPost} onDone={handleDone} />
      )}

      {/* Not logged in prompt */}
      {!user && (
        <div className="bg-white/[0.03] border border-white/10 rounded-lg p-4 mb-4 text-center">
          <p className="text-white text-sm">
            <button onClick={() => appClient.auth.redirectToLogin(window.location.href)} className="text-red-500 hover:text-red-400 underline">
              Connectez-vous
            </button>{' '}
            pour publier sur le fil de la communauté
          </p>
        </div>
      )}

      {/* Posts list — scrollable, shows ~3 posts at a time */}
      {isLoading ? (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-2 border-white/20 border-t-red-600 rounded-full animate-spin" />
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-white text-sm">Aucun post pour le moment</p>
        </div>
      ) : (
        <div className="max-h-[520px] sm:max-h-[600px] md:max-h-[680px] overflow-y-auto space-y-3 sm:space-y-4 pr-1 -mr-1">
          {posts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              user={user}
              avatarUrl={avatarMap[post.member_email]}
              onEdit={() => handleEdit(post)}
              onDelete={() => handleDelete(post)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
