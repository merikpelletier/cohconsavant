import React, { useState } from 'react';
import { appClient } from '@/api/appClient';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import PostCard from '@/components/PostCard';
import PostComposer from '@/components/posts/PostComposer';
import { Plus, X } from 'lucide-react';

export default function ProfilePostsSection({ memberEmail, memberName }) {
  const { user } = useAuth();
  const [showComposer, setShowComposer] = useState(false);
  const isOwnProfile = Boolean(
    user?.email && memberEmail && user.email.toLowerCase() === memberEmail.toLowerCase()
  );

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['memberPostsByEmail', memberEmail],
    queryFn: async () =>
      (await appClient.functions.invoke('manageMemberPost', {
        action: 'filter',
        filters: { member_email: memberEmail },
        sort: '-created_date',
      })).data.items,
    enabled: !!memberEmail,
    staleTime: 30 * 1000,
  });

  return (
    <div className="space-y-4">
      {isOwnProfile && (
        <>
          <button
            type="button"
            onClick={() => setShowComposer((open) => !open)}
            className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700"
          >
            {showComposer ? <X size={16} /> : <Plus size={16} />}
            {showComposer ? 'Fermer' : 'Créer une publication'}
          </button>

          {showComposer && (
            <PostComposer
              user={user}
              editingPost={null}
              onDone={() => setShowComposer(false)}
            />
          )}
        </>
      )}

      {isLoading ? (
        <div className="flex justify-center py-6">
          <div className="w-6 h-6 border-2 border-white border-t-red-600 rounded-full animate-spin" />
        </div>
      ) : posts.length === 0 ? (
        <p className="text-white text-sm py-4">Aucune publication pour le moment.</p>
      ) : (
        <div className="max-h-[520px] overflow-y-auto space-y-4 pr-1 -mr-1">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              user={user}
              avatarUrl={null}
            />
          ))}
        </div>
      )}
    </div>
  );
}
