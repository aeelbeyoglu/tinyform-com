"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, Check, Code, FileCode } from "lucide-react";
import { toast } from "sonner";

interface EmbedCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  publicId: string;
  formTitle: string;
}

export function EmbedCodeDialog({ open, onOpenChange, publicId, formTitle }: EmbedCodeDialogProps) {
  const [copiedTab, setCopiedTab] = useState<string | null>(null);
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  // Generate iframe code
  const iframeCode = `<iframe
  src="${baseUrl}/embed/${publicId}"
  width="100%"
  height="500"
  frameborder="0"
  title="${formTitle.replace(/"/g, '&quot;')}"
  style="border: none; width: 100%; min-height: 500px;"
></iframe>`;

  // Generate JavaScript embed code
  const scriptCode = `<!-- TinyForm Embed Script -->
<div id="tinyform-${publicId}"></div>
<script>
(function() {
  var iframe = document.createElement('iframe');
  iframe.src = '${baseUrl}/embed/${publicId}';
  iframe.style.width = '100%';
  iframe.style.border = 'none';
  iframe.style.minHeight = '500px';
  iframe.title = '${formTitle.replace(/'/g, "\\'")}';

  // Auto-resize iframe based on content
  window.addEventListener('message', function(e) {
    if (e.data.type === 'tinyform-resize' && iframe.contentWindow === e.source) {
      iframe.style.height = e.data.height + 'px';
    }
    // Handle form submission
    if (e.data.type === 'tinyform-submitted') {
      console.log('Form submitted successfully');
      // You can add custom callback here
    }
    // Handle redirect
    if (e.data.type === 'tinyform-redirect') {
      window.location.href = e.data.url;
    }
  });

  document.getElementById('tinyform-${publicId}').appendChild(iframe);
})();
</script>`;

  // Direct link
  const directLink = `${baseUrl}/f/${publicId}`;

  const copyToClipboard = async (text: string, tab: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedTab(tab);
      toast.success("Copied to clipboard!");
      setTimeout(() => setCopiedTab(null), 2000);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Embed Form</DialogTitle>
          <DialogDescription>
            Choose how you want to embed your form
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="iframe" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="iframe">
              <Code className="mr-2 h-4 w-4" />
              IFrame
            </TabsTrigger>
            <TabsTrigger value="script">
              <FileCode className="mr-2 h-4 w-4" />
              JavaScript
            </TabsTrigger>
            <TabsTrigger value="link">
              <FileCode className="mr-2 h-4 w-4" />
              Direct Link
            </TabsTrigger>
          </TabsList>

          <TabsContent value="iframe">
            <Card>
              <CardHeader>
                <CardTitle>IFrame Embed</CardTitle>
                <CardDescription>
                  Simple iframe embed code. Works on any website that allows iframes.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                    <code>{iframeCode}</code>
                  </pre>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="absolute top-2 right-2"
                    onClick={() => copyToClipboard(iframeCode, "iframe")}
                  >
                    {copiedTab === "iframe" ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="script">
            <Card>
              <CardHeader>
                <CardTitle>JavaScript Embed</CardTitle>
                <CardDescription>
                  Advanced embed with auto-resize and event handling. Paste this code anywhere in your HTML.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                    <code>{scriptCode}</code>
                  </pre>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="absolute top-2 right-2"
                    onClick={() => copyToClipboard(scriptCode, "script")}
                  >
                    {copiedTab === "script" ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    <strong>Features:</strong>
                  </p>
                  <ul className="text-sm text-blue-700 dark:text-blue-300 mt-1 space-y-1 ml-4">
                    <li>• Auto-resizes based on form height</li>
                    <li>• Handles form submission events</li>
                    <li>• Supports redirect after submission</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="link">
            <Card>
              <CardHeader>
                <CardTitle>Direct Link</CardTitle>
                <CardDescription>
                  Share this link directly or use it in emails and social media.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <div className="bg-muted p-4 rounded-lg">
                    <code className="text-sm break-all">{directLink}</code>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="absolute top-2 right-2"
                    onClick={() => copyToClipboard(directLink, "link")}
                  >
                    {copiedTab === "link" ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => window.open(directLink, "_blank")}
                  >
                    Open in New Tab
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="text-sm text-muted-foreground">
          <p>
            <strong>Note:</strong> Your form must be published to be embedded.
            Changes to your form will automatically reflect in all embedded instances.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}