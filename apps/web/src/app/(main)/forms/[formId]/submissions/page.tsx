"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Trash2, Eye, Download, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";

interface Submission {
  id: string;
  formId: string;
  data: Record<string, any>;
  metadata?: {
    ip?: string;
    userAgent?: string;
    referrer?: string;
    country?: string;
  };
  status: string;
  createdAt: string;
}

export default function FormSubmissionsPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const formId = params.formId as string;

  const [loading, setLoading] = useState(true);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [formDetails, setFormDetails] = useState<any>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    if (!user) {
      router.push("/auth/signin");
      return;
    }

    loadFormDetails();
    loadSubmissions();
  }, [user, formId, pagination.page, statusFilter]);

  async function loadFormDetails() {
    try {
      const response = await apiClient.getForm(formId);
      setFormDetails(response.form);
    } catch (error) {
      console.error("Failed to load form details:", error);
      toast.error("Failed to load form details");
    }
  }

  async function loadSubmissions() {
    try {
      setLoading(true);
      const response = await apiClient.getSubmissions(formId, {
        page: pagination.page,
        limit: pagination.limit,
        search: searchQuery,
        status: statusFilter === "all" ? undefined : statusFilter,
      });

      setSubmissions(response.submissions || []);
      setPagination(response.pagination);
    } catch (error) {
      console.error("Failed to load submissions:", error);
      toast.error("Failed to load submissions");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(submissionId: string) {
    if (!confirm("Are you sure you want to delete this submission?")) return;

    try {
      await apiClient.deleteSubmission(submissionId);
      toast.success("Submission deleted successfully");
      await loadSubmissions();
    } catch (error) {
      console.error("Failed to delete submission:", error);
      toast.error("Failed to delete submission");
    }
  }

  function handleSearch() {
    setPagination({ ...pagination, page: 1 });
    loadSubmissions();
  }

  function formatSubmissionData(data: Record<string, any>) {
    return Object.entries(data)
      .map(([key, value]) => {
        if (typeof value === "object" && value !== null) {
          return `${key}: ${JSON.stringify(value)}`;
        }
        return `${key}: ${value}`;
      })
      .join(", ");
  }

  function getFieldNames(submissions: Submission[], formSchema?: any): string[] {
    const fieldNames = new Set<string>();

    // First, add fields from the current form schema if available
    if (formSchema?.formElements) {
      const schemaFields = Array.isArray(formSchema.formElements) ? formSchema.formElements : [];
      schemaFields.forEach((element: any) => {
        if (Array.isArray(element)) {
          // Handle nested elements (side-by-side)
          element.forEach((nestedElement: any) => {
            if (nestedElement.name && !nestedElement.static) {
              fieldNames.add(nestedElement.name);
            }
          });
        } else if (element.name && !element.static) {
          fieldNames.add(element.name);
        }
      });
    }

    // Then add fields from submissions (for backward compatibility)
    submissions.forEach(submission => {
      Object.keys(submission.data).forEach(key => fieldNames.add(key));
    });

    return Array.from(fieldNames).slice(0, 7); // Show first 7 fields in table
  }

  if (loading && submissions.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const fieldNames = getFieldNames(submissions, formDetails?.schema);

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <Button variant="ghost" asChild>
          <Link href="/forms">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Forms
          </Link>
        </Button>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{formDetails?.title || "Form"} - Submissions</CardTitle>
          <CardDescription>
            Total submissions: {pagination.total}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="flex-1 flex gap-2">
              <Input
                placeholder="Search submissions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="flex-1"
              />
              <Button onClick={handleSearch} variant="secondary">
                <Search className="h-4 w-4" />
              </Button>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processed">Processed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="spam">Spam</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {submissions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No submissions yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    {fieldNames.map(field => (
                      <TableHead key={field} className="capitalize">
                        {field.replace(/_/g, " ")}
                      </TableHead>
                    ))}
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submissions.map((submission) => (
                    <TableRow key={submission.id}>
                      <TableCell>
                        {format(new Date(submission.createdAt), "MMM d, yyyy HH:mm")}
                      </TableCell>
                      {fieldNames.map(field => (
                        <TableCell key={field} className="max-w-[200px] truncate">
                          {submission.data[field] || "-"}
                        </TableCell>
                      ))}
                      <TableCell>
                        <Badge variant={
                          submission.status === "processed" ? "default" :
                          submission.status === "pending" ? "secondary" :
                          submission.status === "failed" ? "destructive" :
                          "outline"
                        }>
                          {submission.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedSubmission(submission)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(submission.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                disabled={pagination.page === 1}
              >
                Previous
              </Button>
              <span className="flex items-center px-3">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                disabled={pagination.page === pagination.totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Submission Dialog */}
      <Dialog open={!!selectedSubmission} onOpenChange={() => setSelectedSubmission(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Submission Details</DialogTitle>
            <DialogDescription>
              Submitted on {selectedSubmission && format(new Date(selectedSubmission.createdAt), "MMMM d, yyyy 'at' HH:mm")}
            </DialogDescription>
          </DialogHeader>
          {selectedSubmission && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Form Data</h3>
                <div className="bg-muted rounded-lg p-4 space-y-2">
                  {(() => {
                    // Get current schema fields
                    const currentFields = new Set<string>();
                    if (formDetails?.schema?.formElements) {
                      const schemaFields = Array.isArray(formDetails.schema.formElements) ? formDetails.schema.formElements : [];
                      schemaFields.forEach((element: any) => {
                        if (Array.isArray(element)) {
                          element.forEach((nestedElement: any) => {
                            if (nestedElement.name && !nestedElement.static) {
                              currentFields.add(nestedElement.name);
                            }
                          });
                        } else if (element.name && !element.static) {
                          currentFields.add(element.name);
                        }
                      });
                    }

                    // Render all submission fields
                    return Object.entries(selectedSubmission.data).map(([key, value]) => {
                      const isInCurrentSchema = currentFields.has(key);
                      return (
                        <div key={key} className="flex flex-col">
                          <span className="text-sm font-medium capitalize flex items-center gap-2">
                            {key.replace(/_/g, " ")}:
                            {!isInCurrentSchema && (
                              <span className="text-xs text-yellow-600 dark:text-yellow-400">
                                (Field removed from form)
                              </span>
                            )}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {typeof value === "object" ? JSON.stringify(value, null, 2) : String(value) || "-"}
                          </span>
                        </div>
                      );
                    });
                  })()}

                  {/* Show new fields that don't have values yet */}
                  {(() => {
                    const submissionKeys = new Set(Object.keys(selectedSubmission.data));
                    const newFields: string[] = [];

                    if (formDetails?.schema?.formElements) {
                      const schemaFields = Array.isArray(formDetails.schema.formElements) ? formDetails.schema.formElements : [];
                      schemaFields.forEach((element: any) => {
                        if (Array.isArray(element)) {
                          element.forEach((nestedElement: any) => {
                            if (nestedElement.name && !nestedElement.static && !submissionKeys.has(nestedElement.name)) {
                              newFields.push(nestedElement.name);
                            }
                          });
                        } else if (element.name && !element.static && !submissionKeys.has(element.name)) {
                          newFields.push(element.name);
                        }
                      });
                    }

                    return newFields.map(field => (
                      <div key={field} className="flex flex-col">
                        <span className="text-sm font-medium capitalize flex items-center gap-2">
                          {field.replace(/_/g, " ")}:
                          <span className="text-xs text-green-600 dark:text-green-400">
                            (New field - no value)
                          </span>
                        </span>
                        <span className="text-sm text-muted-foreground">-</span>
                      </div>
                    ));
                  })()}
                </div>
              </div>
              {selectedSubmission.metadata && (
                <div>
                  <h3 className="font-semibold mb-2">Metadata</h3>
                  <div className="bg-muted rounded-lg p-4 space-y-1">
                    {selectedSubmission.metadata.ip && (
                      <p className="text-sm">IP: {selectedSubmission.metadata.ip}</p>
                    )}
                    {selectedSubmission.metadata.country && (
                      <p className="text-sm">Country: {selectedSubmission.metadata.country}</p>
                    )}
                    {selectedSubmission.metadata.referrer && (
                      <p className="text-sm">Referrer: {selectedSubmission.metadata.referrer}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}