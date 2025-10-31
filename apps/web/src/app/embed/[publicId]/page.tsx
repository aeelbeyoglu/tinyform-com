"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PublicFormRenderer } from "@/app/f/[publicId]/public-form-renderer";

interface PublicForm {
  publicId: string;
  title: string;
  description?: string;
  schema: any;
  settings: any;
  requireAuth?: boolean;
}

export default function EmbedFormPage() {
  const params = useParams();
  const publicId = params.publicId as string;

  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<PublicForm | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load form data
  useEffect(() => {
    async function loadForm() {
      try {
        setLoading(true);
        const response = await apiClient.getPublicForm(publicId);
        setFormData(response);

        // Send height to parent window for iframe resizing
        if (window.parent !== window) {
          const sendHeight = () => {
            window.parent.postMessage({
              type: 'tinyform-resize',
              height: document.body.scrollHeight
            }, '*');
          };

          // Send initial height
          setTimeout(sendHeight, 100);

          // Watch for changes
          const observer = new ResizeObserver(sendHeight);
          observer.observe(document.body);

          return () => observer.disconnect();
        }
      } catch (err: any) {
        console.error("Failed to load form:", err);
        if (err.status === 404) {
          setError("This form could not be found.");
        } else if (err.status === 410) {
          setError(err.message || "This form is no longer available.");
        } else {
          setError("Failed to load the form. Please try again later.");
        }
      } finally {
        setLoading(false);
      }
    }

    loadForm();
  }, [publicId]);

  // Handle form submission
  async function handleSubmit(data: any) {
    try {
      setSubmitting(true);
      const response = await apiClient.submitPublicForm(publicId, data);

      if (response.success) {
        setSubmitted(true);

        // Notify parent window
        if (window.parent !== window) {
          window.parent.postMessage({
            type: 'tinyform-submitted',
            publicId,
            success: true
          }, '*');
        }

        // Handle redirect if configured
        if (response.redirectUrl) {
          if (window.parent !== window) {
            // In iframe, send message to parent to redirect
            window.parent.postMessage({
              type: 'tinyform-redirect',
              url: response.redirectUrl
            }, '*');
          } else {
            // Not in iframe, redirect directly
            setTimeout(() => {
              window.location.href = response.redirectUrl;
            }, 2000);
          }
        }
      }
    } catch (err: any) {
      console.error("Failed to submit form:", err);
      toast.error(err.message || "Failed to submit form. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-[200px] flex items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Error state
  if (error || !formData) {
    return (
      <div className="min-h-[200px] flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-destructive">
            {error || "This form could not be loaded."}
          </p>
        </div>
      </div>
    );
  }

  // Success state
  if (submitted && !formData.settings?.redirectUrl) {
    return (
      <div className="min-h-[200px] flex items-center justify-center p-4">
        <div className="text-center">
          <div className="mx-auto mb-4">
            <svg
              className="h-12 w-12 text-green-500 mx-auto"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold mb-2">Thank You!</h3>
          <p className="text-muted-foreground">
            {formData.settings?.successMessage || "Your response has been recorded."}
          </p>
        </div>
      </div>
    );
  }

  // Form display - minimal styling for embedding
  return (
    <div className="w-full p-4">
      <div className="mb-4">
        <h2 className="text-xl font-semibold">{formData.title}</h2>
        {formData.description && (
          <p className="text-sm text-muted-foreground mt-1">{formData.description}</p>
        )}
      </div>
      <PublicFormRenderer
        formData={formData}
        onSubmit={handleSubmit}
      />
    </div>
  );
}