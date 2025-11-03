"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend } from "recharts";
import { TrendingUp, FileText, Send, CheckCircle, Clock, Loader2, Eye, Target } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AnalyticsOverview {
  totalForms: number;
  totalSubmissions: number;
  publishedForms: number;
  draftForms: number;
  recentSubmissions: { date: string; count: number }[];
  topForms: {
    id: string;
    title: string;
    publicId: string;
    submissionCount: number;
  }[];
}

interface FormAnalytics {
  formId: string;
  formTitle: string;
  totalSubmissions: number;
  totalViews: number;
  conversionRate: number;
  submissionsByDate: { date: string; submissions: number }[];
  submissionsByStatus: { status: string; count: number }[];
}

interface Form {
  id: string;
  title: string;
  status: string;
  publicId: string;
}

const chartConfig = {
  submissions: {
    label: "Submissions",
    color: "hsl(var(--primary))",
  },
  published: {
    label: "Published",
    color: "hsl(var(--chart-1))",
  },
  draft: {
    label: "Draft",
    color: "hsl(var(--chart-2))",
  },
  pending: {
    label: "Pending",
    color: "hsl(var(--chart-3))",
  },
  processed: {
    label: "Processed",
    color: "hsl(var(--chart-4))",
  },
  failed: {
    label: "Failed",
    color: "hsl(var(--chart-5))",
  },
};

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null);
  const [forms, setForms] = useState<Form[]>([]);
  const [selectedFormId, setSelectedFormId] = useState<string>("");
  const [formAnalytics, setFormAnalytics] = useState<FormAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch overview analytics and forms list
  useEffect(() => {
    async function fetchData() {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const [analyticsData, formsData] = await Promise.all([
          apiClient.getAnalyticsOverview(),
          apiClient.getForms({ page: 1, limit: 100 }),
        ]);

        setAnalytics(analyticsData);
        setForms(formsData.forms);
      } catch (err: any) {
        console.error("Failed to fetch analytics:", err);
        setError(err.message || "Failed to load analytics");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [user]);

  // Fetch form-specific analytics when form is selected
  useEffect(() => {
    async function fetchFormAnalytics() {
      if (!selectedFormId) {
        setFormAnalytics(null);
        return;
      }

      setFormLoading(true);
      try {
        const data = await apiClient.getFormAnalytics(selectedFormId);
        setFormAnalytics(data);
      } catch (err: any) {
        console.error("Failed to fetch form analytics:", err);
        setError(err.message || "Failed to load form analytics");
      } finally {
        setFormLoading(false);
      }
    }

    fetchFormAnalytics();
  }, [selectedFormId]);

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">Sign in to view analytics</h2>
              <p className="text-muted-foreground mb-4">
                You need to be signed in to access analytics
              </p>
              <Button asChild>
                <Link href="/auth/signin">Sign In</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-destructive">
              <p>{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!analytics) {
    return null;
  }

  // Format data for overview charts
  const submissionsChartData = analytics.recentSubmissions.map((item) => ({
    date: new Date(item.date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    submissions: item.count,
  }));

  const formsStatusData = [
    { name: "Published", value: analytics.publishedForms, fill: "hsl(var(--chart-1))" },
    { name: "Draft", value: analytics.draftForms, fill: "hsl(var(--chart-2))" },
  ];

  const topFormsData = analytics.topForms.map((form) => ({
    name: form.title.length > 20 ? form.title.substring(0, 20) + "..." : form.title,
    submissions: form.submissionCount,
    id: form.id,
  }));

  const totalFormsWithStatus = analytics.publishedForms + analytics.draftForms;
  const avgSubmissionsPerForm = analytics.totalForms > 0
    ? (analytics.totalSubmissions / analytics.totalForms).toFixed(1)
    : "0";

  // Format data for form-specific charts
  const formSubmissionsData = formAnalytics?.submissionsByDate.map((item) => ({
    date: new Date(item.date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    submissions: item.submissions,
  })) || [];

  const formStatusData = formAnalytics?.submissionsByStatus.map((item) => ({
    name: item.status.charAt(0).toUpperCase() + item.status.slice(1),
    value: item.count,
    fill: `hsl(var(--chart-${item.status === 'pending' ? '3' : item.status === 'processed' ? '4' : '5'}))`,
  })) || [];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Analytics Dashboard</h1>
        <p className="text-muted-foreground">
          Track your form performance and submission metrics
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="form">Form Analytics</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Stats Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Forms</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.totalForms}</div>
                <p className="text-xs text-muted-foreground">
                  {analytics.publishedForms} published, {analytics.draftForms} draft
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Submissions</CardTitle>
                <Send className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.totalSubmissions}</div>
                <p className="text-xs text-muted-foreground">
                  Across all forms
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Published Forms</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.publishedForms}</div>
                <p className="text-xs text-muted-foreground">
                  Live and accepting submissions
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg. Submissions/Form</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{avgSubmissionsPerForm}</div>
                <p className="text-xs text-muted-foreground">
                  Submissions per form
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Charts Grid */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Submissions Over Time */}
            <Card>
              <CardHeader>
                <CardTitle>Submissions (Last 7 Days)</CardTitle>
                <CardDescription>Daily submission trends</CardDescription>
              </CardHeader>
              <CardContent>
                {submissionsChartData.length > 0 ? (
                  <ChartContainer config={chartConfig} className="h-[300px]">
                    <LineChart data={submissionsChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis tick={{ fontSize: 12 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line
                        type="monotone"
                        dataKey="submissions"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ fill: "hsl(var(--primary))" }}
                      />
                    </LineChart>
                  </ChartContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    No submission data available
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Form Status Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Form Status Distribution</CardTitle>
                <CardDescription>Published vs Draft forms</CardDescription>
              </CardHeader>
              <CardContent>
                {totalFormsWithStatus > 0 ? (
                  <ChartContainer config={chartConfig} className="h-[300px]">
                    <PieChart>
                      <Pie
                        data={formsStatusData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) =>
                          `${name}: ${(percent * 100).toFixed(0)}%`
                        }
                        outerRadius={80}
                        dataKey="value"
                      >
                        {formsStatusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Legend />
                    </PieChart>
                  </ChartContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    No forms created yet
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Top Performing Forms */}
          <Card>
            <CardHeader>
              <CardTitle>Top Performing Forms</CardTitle>
              <CardDescription>Forms with the most submissions</CardDescription>
            </CardHeader>
            <CardContent>
              {topFormsData.length > 0 && topFormsData.some(f => f.submissions > 0) ? (
                <ChartContainer config={chartConfig} className="h-[300px]">
                  <BarChart data={topFormsData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 12 }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar
                      dataKey="submissions"
                      fill="hsl(var(--primary))"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ChartContainer>
              ) : (
                <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground">
                  <p>No submission data available</p>
                  <p className="text-sm mt-2">Forms will appear here once they receive submissions</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Form Analytics Tab */}
        <TabsContent value="form" className="space-y-6">
          {/* Form Selector */}
          <Card>
            <CardHeader>
              <CardTitle>Select a Form</CardTitle>
              <CardDescription>Choose a form to view detailed analytics</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedFormId} onValueChange={setSelectedFormId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a form..." />
                </SelectTrigger>
                <SelectContent>
                  {forms.map((form) => (
                    <SelectItem key={form.id} value={form.id}>
                      {form.title} ({form.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Form-Specific Analytics */}
          {formLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-32" />
              <div className="grid gap-4 md:grid-cols-2">
                <Skeleton className="h-96" />
                <Skeleton className="h-96" />
              </div>
            </div>
          ) : formAnalytics ? (
            <>
              {/* Form Stats */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Submissions</CardTitle>
                    <Send className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formAnalytics.totalSubmissions}</div>
                    <p className="text-xs text-muted-foreground">
                      For {formAnalytics.formTitle}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Views</CardTitle>
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formAnalytics.totalViews}</div>
                    <p className="text-xs text-muted-foreground">
                      Form page visits
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
                    <Target className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formAnalytics.conversionRate}%</div>
                    <p className="text-xs text-muted-foreground">
                      Submissions / Views
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Form Status</CardTitle>
                    <CheckCircle className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold capitalize">
                      {forms.find(f => f.id === selectedFormId)?.status || 'N/A'}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Current form status
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Form Charts */}
              <div className="grid gap-4 md:grid-cols-2">
                {/* Form Submissions Over Time */}
                <Card>
                  <CardHeader>
                    <CardTitle>Submissions (Last 30 Days)</CardTitle>
                    <CardDescription>Daily submission trends for this form</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {formSubmissionsData.length > 0 ? (
                      <ChartContainer config={chartConfig} className="h-[300px]">
                        <LineChart data={formSubmissionsData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="date"
                            tick={{ fontSize: 12 }}
                          />
                          <YAxis tick={{ fontSize: 12 }} />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Line
                            type="monotone"
                            dataKey="submissions"
                            stroke="hsl(var(--primary))"
                            strokeWidth={2}
                            dot={{ fill: "hsl(var(--primary))" }}
                          />
                        </LineChart>
                      </ChartContainer>
                    ) : (
                      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                        No submission data for this form
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Submissions by Status */}
                <Card>
                  <CardHeader>
                    <CardTitle>Submissions by Status</CardTitle>
                    <CardDescription>Breakdown of submission statuses</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {formStatusData.length > 0 ? (
                      <ChartContainer config={chartConfig} className="h-[300px]">
                        <PieChart>
                          <Pie
                            data={formStatusData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) =>
                              `${name}: ${(percent * 100).toFixed(0)}%`
                            }
                            outerRadius={80}
                            dataKey="value"
                          >
                            {formStatusData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                          </Pie>
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Legend />
                        </PieChart>
                      </ChartContainer>
                    ) : (
                      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                        No status data available
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Quick Actions */}
              <div className="flex gap-4">
                <Button asChild>
                  <Link href={`/forms/${selectedFormId}/submissions`}>View Submissions</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={`/form-builder?id=${selectedFormId}`}>Edit Form</Link>
                </Button>
                {forms.find(f => f.id === selectedFormId)?.publicId && (
                  <Button asChild variant="outline">
                    <Link
                      href={`/f/${forms.find(f => f.id === selectedFormId)?.publicId}`}
                      target="_blank"
                    >
                      View Live Form
                    </Link>
                  </Button>
                )}
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center text-muted-foreground">
                  <p>Select a form to view detailed analytics</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Global Quick Actions */}
      <div className="mt-8 flex gap-4">
        <Button asChild>
          <Link href="/forms">View All Forms</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/ai-form-generator">Create New Form</Link>
        </Button>
      </div>
    </div>
  );
}
