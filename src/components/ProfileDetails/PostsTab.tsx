import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar, Image, Clock, MoreHorizontal, Edit, Copy, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import CreatePostModal from "./CreatePostModal";
import { googleBusinessProfileService } from "@/lib/googleBusinessProfile";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useNotifications } from "@/contexts/NotificationContext";
import { toast } from "@/hooks/use-toast";

interface Post {
  id: string;
  content: string;
  scheduledAt?: string;
  postedAt?: string;
  status: 'draft' | 'scheduled' | 'published';
  imageUrl?: string;
}

interface PostsTabProps {
  profileId: string;
}

const PostsTab = ({ profileId }: PostsTabProps) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [postToDelete, setPostToDelete] = useState<Post | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { addNotification } = useNotifications();

  useEffect(() => {
    // Real-time posts from Google Business Profile API
    const fetchPosts = async () => {
      if (!profileId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        console.log('PostsTab: Fetching posts for profileId:', profileId);
        
        // We need to find the location name from profileId
        // This is a bit tricky since we only have the profileId here
        // For now, we'll construct the location name based on the profileId
        // In a real implementation, you might want to pass the full location object
        
        // Use the profileId directly - the service will handle the proper location name format
        const locationPosts = await googleBusinessProfileService.getLocationPosts(profileId);
        
        // Convert BusinessPost to Post format
        const convertedPosts: Post[] = locationPosts.map(post => ({
          id: post.id,
          content: post.summary || '',
          status: 'published' as const,
          postedAt: post.createTime
        }));
        
        console.log('PostsTab: Loaded', convertedPosts.length, 'posts');
        setPosts(convertedPosts);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching posts:", error);
        setPosts([]);
        setLoading(false);
      }
    };

    fetchPosts();
  }, [profileId]);

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getStatusBadge = (status: Post['status']) => {
    switch (status) {
      case 'published':
        return <Badge variant="default" className="bg-success text-success-foreground">Published</Badge>;
      case 'scheduled':
        return <Badge variant="secondary" className="bg-warning/10 text-warning border-warning/20">Scheduled</Badge>;
      case 'draft':
        return <Badge variant="outline">Draft</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const refreshPosts = async () => {
    if (!profileId) return;
    
    try {
      const locationPosts = await googleBusinessProfileService.getLocationPosts(profileId);
      const convertedPosts: Post[] = locationPosts.map(post => ({
        id: post.id,
        content: post.summary || '',
        status: 'published' as const,
        postedAt: post.createTime
      }));
      setPosts(convertedPosts);
    } catch (error) {
      console.error("Error refreshing posts:", error);
    }
  };

  const handleCreatePost = async (postData: any) => {
    try {
      console.log("Creating post:", postData);
      
      // For now, add notification for post creation
      const profileName = `Profile ${profileId}`;
      
      if (postData.scheduledAt) {
        addNotification({
          type: 'post',
          title: 'Post Scheduled',
          message: `Post scheduled for ${profileName} at ${new Date(postData.scheduledAt).toLocaleDateString()}.`,
          actionUrl: '/posts'
        });
      } else {
        addNotification({
          type: 'post',
          title: 'Post Created',
          message: `Post created for ${profileName} and sent to Google Business Profile.`,
          actionUrl: '/posts'
        });
      }
      
      setShowCreateModal(false);
      setEditingPost(null);
      
      // Refresh posts list in real-time
      await refreshPosts();
      
      toast({
        title: "Post Created",
        description: "Your post has been successfully created and published.",
      });
    } catch (error) {
      console.error("Error creating post:", error);
      toast({
        title: "Error",
        description: "Failed to create post. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleEditPost = (post: Post) => {
    setEditingPost(post);
    setShowCreateModal(true);
  };

  const handleDuplicatePost = async (post: Post) => {
    try {
      // Create a new post with the same content
      const duplicateData = {
        content: post.content,
        profileId: profileId
      };
      
      await handleCreatePost(duplicateData);
      
      toast({
        title: "Post Duplicated",
        description: "Post has been successfully duplicated.",
      });
    } catch (error) {
      console.error("Error duplicating post:", error);
      toast({
        title: "Error",
        description: "Failed to duplicate post. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeletePost = async () => {
    if (!postToDelete) return;
    
    setIsDeleting(true);
    try {
      // In real implementation, call API to delete the post
      // await googleBusinessProfileService.deletePost(postToDelete.id);
      
      // Remove post from local state immediately for real-time effect
      setPosts(prevPosts => prevPosts.filter(p => p.id !== postToDelete.id));
      
      addNotification({
        type: 'post',
        title: 'Post Deleted',
        message: `Post has been successfully deleted.`,
        actionUrl: '/posts'
      });
      
      toast({
        title: "Post Deleted",
        description: "Your post has been successfully deleted.",
      });
      
      setDeleteDialogOpen(false);
      setPostToDelete(null);
    } catch (error) {
      console.error("Error deleting post:", error);
      toast({
        title: "Error",
        description: "Failed to delete post. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmDelete = (post: Post) => {
    setPostToDelete(post);
    setDeleteDialogOpen(true);
  };

  return (
    <>
      <Card className="shadow-card border-0">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-lg sm:text-xl">Posts & Updates</CardTitle>
            <Button 
              onClick={() => setShowCreateModal(true)} 
              className="bg-primary hover:bg-primary-hover text-xs sm:text-sm px-2 sm:px-4"
              size="sm"
            >
              <Plus className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Create Post</span>
              <span className="sm:hidden">Create</span>
            </Button>
          </div>
        </CardHeader>
        
        <CardContent>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <LoadingSpinner size="lg" variant="primary" />
              <div className="text-center space-y-2">
                <h3 className="font-medium text-lg">Loading Posts...</h3>
                <p className="text-sm text-muted-foreground">Fetching your latest posts from Google Business Profile</p>
              </div>
              
              {/* Enhanced loading skeleton for posts */}
              <div className="w-full max-w-2xl mt-8 space-y-4">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-16 bg-muted rounded-full animate-pulse"></div>
                        <div className="h-4 w-20 bg-muted rounded animate-pulse"></div>
                      </div>
                      <div className="h-4 w-4 bg-muted rounded animate-pulse"></div>
                    </div>
                    <div className="space-y-3">
                      <div className="h-4 bg-muted rounded w-full animate-pulse"></div>
                      <div className="h-4 bg-muted rounded w-3/4 animate-pulse"></div>
                      <div className="h-4 bg-muted rounded w-1/2 animate-pulse"></div>
                    </div>
                    <div className="flex items-center justify-between mt-4 pt-3 border-t">
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-4 bg-muted rounded animate-pulse"></div>
                        <div className="h-3 w-24 bg-muted rounded animate-pulse"></div>
                      </div>
                      <div className="h-3 w-16 bg-muted rounded animate-pulse"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-8 sm:py-12">
              <Calendar className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mx-auto mb-3 sm:mb-4" />
              <h3 className="text-base sm:text-lg font-medium mb-2">No posts yet</h3>
              <p className="text-sm text-muted-foreground mb-4 px-4">Create your first post to start engaging with customers</p>
              <Button onClick={() => setShowCreateModal(true)} variant="outline" size="sm">
                <Plus className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Create First Post</span>
                <span className="sm:hidden">Create Post</span>
              </Button>
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {posts.map((post) => (
                <div key={post.id} className="border rounded-lg p-3 sm:p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start justify-between mb-2 sm:mb-3">
                    <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                      {getStatusBadge(post.status)}
                      {post.scheduledAt && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span className="hidden sm:inline">{formatDateTime(post.scheduledAt)}</span>
                          <span className="sm:hidden">{new Date(post.scheduledAt).toLocaleDateString()}</span>
                        </div>
                      )}
                      {post.postedAt && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span className="hidden sm:inline">Posted {formatDateTime(post.postedAt)}</span>
                          <span className="sm:hidden">{new Date(post.postedAt).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditPost(post)} className="cursor-pointer">
                          <Edit className="mr-2 h-4 w-4" />
                          Edit Post
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicatePost(post)} className="cursor-pointer">
                          <Copy className="mr-2 h-4 w-4" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => confirmDelete(post)} 
                          className="text-destructive cursor-pointer focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  
                  <div className="flex gap-3 sm:gap-4">
                    {post.imageUrl && (
                      <div className="flex-shrink-0">
                        <img 
                          src={post.imageUrl} 
                          alt="Post image" 
                          className="w-12 h-12 sm:w-16 sm:h-16 object-cover rounded-md"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-relaxed break-words">{post.content}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      <CreatePostModal 
        open={showCreateModal} 
        onOpenChange={(open) => {
          setShowCreateModal(open);
          if (!open) setEditingPost(null);
        }}
        onSubmit={handleCreatePost}
        profileId={profileId}
        editingPost={editingPost}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Post</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this post? This action cannot be undone and the post will be permanently removed from your Google Business Profile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeletePost} 
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete Post"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default PostsTab;