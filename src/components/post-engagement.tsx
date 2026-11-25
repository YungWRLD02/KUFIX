import { Heart, MessageCircle, Trash2 } from 'lucide-react';
import { toggleLikeAction, addCommentAction, deleteCommentAction } from '@/app/social/actions';

export type PostComment = { id: string; body: string; name: string; createdAt: Date; mine: boolean };
export type PostEngagementData = { counts: Map<string, { likes: number; comments: number; liked: boolean }>; comments: Map<string, PostComment[]> };

function DeleteButton({ commentId, referrer, token }: { commentId: string; referrer: string; token: string }) {
  return <form action={deleteCommentAction} className="post-comment-delete"><input type="hidden" name="id" value={commentId}/><input type="hidden" name="referrer" value={referrer}/><input type="hidden" name="t" value={token}/><button type="submit" aria-label="Delete comment"><Trash2 size={13}/></button></form>;
}

export default function PostEngagement({ postType, postId, me, engagement, referrer = '/dashboard', token = '' }: { postType: 'work' | 'job'; postId: string; me: boolean; engagement: PostEngagementData; referrer?: string; token?: string }) {
  const data = engagement.counts.get(postId) || { likes: 0, comments: 0, liked: false };
  const comments = engagement.comments.get(postId) || [];
  return <div className="post-engagement">
    <div className="post-engagement-row">
      <form action={toggleLikeAction}><input type="hidden" name="postType" value={postType}/><input type="hidden" name="postId" value={postId}/><input type="hidden" name="referrer" value={referrer}/><input type="hidden" name="t" value={token}/><button type="submit" className={`post-like-button ${data.liked ? 'liked' : ''}`} aria-label={data.liked ? 'Unlike' : 'Like'}><Heart size={15} fill={data.liked ? 'currentColor' : 'none'}/><span>{data.likes}</span></button></form>
      <span className="post-comment-count"><MessageCircle size={15}/>{comments.length} comment{comments.length === 1 ? '' : 's'}</span>
    </div>
    {comments.length > 0 && <div className="post-comments">{comments.map(comment => <div key={comment.id} className="post-comment"><div className="post-comment-head"><strong>{comment.mine ? 'You' : comment.name}</strong><span className="post-comment-time">{new Date(comment.createdAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}</span>{comment.mine && <DeleteButton commentId={comment.id} referrer={referrer} token={token}/>}</div><p>{comment.body}</p></div>)}</div>}
    {me && <form action={addCommentAction} className="post-comment-form"><input type="hidden" name="postType" value={postType}/><input type="hidden" name="postId" value={postId}/><input type="hidden" name="referrer" value={referrer}/><input type="hidden" name="t" value={token}/><input name="body" placeholder="Write a comment..." maxLength={1000} required aria-label="Add a comment"/><button type="submit">Comment</button></form>}
    {!me && <p className="post-engagement-note">Likes and comments need a real account — sign in to join in.</p>}
  </div>;
}
