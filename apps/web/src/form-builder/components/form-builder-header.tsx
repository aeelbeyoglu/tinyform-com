"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  ExternalLink,
  Save,
  CheckCircle2,
  Clock,
  ArrowLeft,
  Sparkles
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface FormBuilderHeaderProps {
  formId?: string;
  title: string;
  description?: string;
  status?: 'draft' | 'published' | 'archived';
  isApiForm: boolean;
  isGuest?: boolean;
  onTitleChange: (title: string) => void;
  onDescriptionChange: (description: string) => void;
  onPublish: () => Promise<void>;
  onSave?: () => Promise<void>;
}

export function FormBuilderHeader({
  formId,
  title,
  description,
  status = 'draft',
  isApiForm,
  isGuest = false,
  onTitleChange,
  onDescriptionChange,
  onPublish,
  onSave,
}: FormBuilderHeaderProps) {
  const router = useRouter();
  const [localTitle, setLocalTitle] = useState(title);
  const [localDescription, setLocalDescription] = useState(description || "");
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setLocalTitle(title);
  }, [title]);

  useEffect(() => {
    setLocalDescription(description || "");
  }, [description]);

  const handleTitleBlur = () => {
    if (localTitle !== title) {
      onTitleChange(localTitle || "Untitled Form");
    }
  };

  const handleDescriptionBlur = () => {
    if (localDescription !== description) {
      onDescriptionChange(localDescription);
    }
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      await onPublish();
    } finally {
      setIsPublishing(false);
    }
  };

  const handleSave = async () => {
    if (!onSave) return;
    setIsSaving(true);
    try {
      await onSave();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="border-b bg-background sticky top-0 z-40">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-start justify-between gap-4">
          {/* Left Section - Form Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/forms")}
                className="gap-1"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Forms
              </Button>

              {status && (
                <Badge
                  variant={status === 'published' ? 'default' : 'secondary'}
                  className={cn(
                    "font-medium",
                    status === 'published' && "bg-green-600 hover:bg-green-700",
                    status === 'draft' && "bg-yellow-600 hover:bg-yellow-700"
                  )}
                >
                  {status === 'published' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                  {status === 'draft' && <Clock className="h-3 w-3 mr-1" />}
                  {status}
                </Badge>
              )}

              {isGuest ? (
                <Badge variant="outline" className="gap-1 border-blue-200 bg-blue-50 text-blue-700">
                  <Sparkles className="h-3 w-3" />
                  Guest Mode - Sign up to publish
                </Badge>
              ) : (
                isApiForm && (
                  <Badge variant="outline" className="gap-1">
                    <Sparkles className="h-3 w-3" />
                    Auto-save enabled
                  </Badge>
                )
              )}
            </div>

            <Input
              value={localTitle}
              onChange={(e) => setLocalTitle(e.target.value)}
              onBlur={handleTitleBlur}
              className="text-2xl font-bold h-auto border-0 px-0 focus-visible:ring-0 mb-2"
              placeholder="Untitled Form"
            />

            <Textarea
              value={localDescription}
              onChange={(e) => setLocalDescription(e.target.value)}
              onBlur={handleDescriptionBlur}
              className="resize-none border-0 px-0 focus-visible:ring-0 min-h-[60px]"
              placeholder="Add a description for your form..."
              rows={2}
            />
          </div>

          {/* Right Section - Actions */}
          <div className="flex items-start gap-2 flex-shrink-0">
            {!isApiForm && onSave && (
              <Button
                onClick={handleSave}
                disabled={isSaving}
                variant="outline"
                className="gap-2"
              >
                {isSaving ? (
                  <>
                    <Save className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save
                  </>
                )}
              </Button>
            )}

            {status === 'draft' ? (
              <Button
                onClick={handlePublish}
                disabled={isPublishing}
                className="gap-2"
                title={isGuest ? "Sign up to publish your form" : "Publish your form"}
              >
                {isPublishing ? (
                  <>
                    <ExternalLink className="h-4 w-4 animate-pulse" />
                    Publishing...
                  </>
                ) : (
                  <>
                    <ExternalLink className="h-4 w-4" />
                    {isGuest ? "Sign up & Publish" : "Publish Form"}
                  </>
                )}
              </Button>
            ) : status === 'published' && formId ? (
              <Button
                variant="outline"
                onClick={() => window.open(`/f/${formId}`, '_blank')}
                className="gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                View Live Form
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
