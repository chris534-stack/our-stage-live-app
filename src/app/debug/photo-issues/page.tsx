import { PhotoDebugTool } from '@/components/debug/PhotoDebugTool';

export default function PhotoIssuesDebugPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Photo Issues Debug Tool
          </h1>
          <p className="text-gray-600">
            Debug broken photo links and upload issues. Test Firebase Storage permissions and URL accessibility.
          </p>
        </div>
        
        <PhotoDebugTool />
        
        <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h3 className="font-semibold text-yellow-800 mb-2">Known Issues:</h3>
          <ul className="text-sm text-yellow-700 space-y-1">
            <li>• Zoë's profile has broken photo links (permissions issue)</li>
            <li>• Moura reported client-side upload crashes (long loading, then crash)</li>
            <li>• Some Firebase Storage URLs return 403 errors</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
