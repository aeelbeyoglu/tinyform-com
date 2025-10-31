"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PublicFormRenderer } from "./public-form-renderer";

interface PublicForm {
  publicId: string;
  title: string;
  description?: string;
  schema: any;
  settings: any;
  requireAuth?: boolean;
}

export default function PublicFormPage() {
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
        toast.success(response.message || "Form submitted successfully!");

        // Handle redirect if configured
        if (response.redirectUrl) {
          setTimeout(() => {
            window.location.href = response.redirectUrl;
          }, 2000);
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
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Error state
  if (error || !formData) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Form Not Available</CardTitle>
            <CardDescription>
              {error || "This form could not be loaded."}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Success state
  if (submitted && !formData.settings?.redirectUrl) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              <svg
                className="h-12 w-12 text-green-500"
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
            <CardTitle>Thank You!</CardTitle>
            <CardDescription className="mt-2">
              {formData.settings?.successMessage || "Your response has been recorded."}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Form display
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>{formData.title}</CardTitle>
            {formData.description && (
              <CardDescription>{formData.description}</CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <PublicFormRenderer
              formData={formData}
              onSubmit={handleSubmit}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}