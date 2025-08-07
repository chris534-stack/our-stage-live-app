import { ImageDeletionTester } from '@/components/debug/ImageDeletionTester';
import AdminAuthGuard from '@/components/auth/AdminAuthGuard';

export default function ImageDeletionDebugPage() {
  return (
    <AdminAuthGuard>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Image Deletion Debug Tool
            </h1>
            <p className="text-gray-600">
              Admin-only testing and debugging interface for image deletion functionality
            </p>
          </div>
          <ImageDeletionTester />
        </div>
      </div>
    </AdminAuthGuard>
  );
}
