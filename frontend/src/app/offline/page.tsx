import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { WifiOff, CheckCircle } from "lucide-react";

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-orange-50 to-red-100 px-4">
      <Card className="w-full max-w-md border-0 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-t-lg">
          <div className="flex items-center gap-2">
            <WifiOff className="h-6 w-6" />
            <CardTitle>No Connection</CardTitle>
          </div>
        </CardHeader>

        <CardContent className="pt-6 text-center">
          <p className="text-muted-foreground">
            You appear to be offline. The app will continue to work with cached data.
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            Transactions will be synced automatically when you're back online.
          </p>

          <Alert className="mt-6 border-blue-200 bg-blue-50">
            <CheckCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-900">
              <p className="font-semibold">Offline Mode Active</p>
              <ul className="mt-2 text-left text-sm space-y-1">
                <li>✓ View cached products</li>
                <li>✓ Create transactions</li>
                <li>✓ View history</li>
                <li>✓ Auto-sync when online</li>
              </ul>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
