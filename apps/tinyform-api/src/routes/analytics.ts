import { Hono } from 'hono';
import type { Env } from '~/types/env';
import { requireAuth } from '~/middleware/auth';
import { createDb } from '~/db';
import { forms, formSubmissions, formAnalytics } from '~/db/schema';
import { eq, and, sql, gte, desc } from 'drizzle-orm';

const app = new Hono<{ Bindings: Env }>();

// Apply auth to all routes
app.use('*', requireAuth());

// GET /analytics/forms/:id - Get form analytics
app.get('/forms/:id', async (c) => {
  const formId = c.req.param('id');
  const userId = c.get('userId');
  const db = createDb(c.env);

  try {
    // Verify form ownership
    const form = await db.query.forms.findFirst({
      where: and(
        eq(forms.id, formId),
        eq(forms.userId, userId)
      ),
    });

    if (!form) {
      return c.json({ error: 'Form not found' }, 404);
    }

    // Get submission stats grouped by date (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const submissionsByDate = await db
      .select({
        date: sql<string>`DATE(${formSubmissions.createdAt})`,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(formSubmissions)
      .where(
        and(
          eq(formSubmissions.formId, formId),
          gte(formSubmissions.createdAt, thirtyDaysAgo)
        )
      )
      .groupBy(sql`DATE(${formSubmissions.createdAt})`)
      .orderBy(sql`DATE(${formSubmissions.createdAt})`);

    // Get total submissions count
    const totalSubmissionsResult = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(formSubmissions)
      .where(eq(formSubmissions.formId, formId));

    const totalSubmissions = totalSubmissionsResult[0]?.count || 0;

    // Get submissions by status
    const submissionsByStatus = await db
      .select({
        status: formSubmissions.status,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(formSubmissions)
      .where(eq(formSubmissions.formId, formId))
      .groupBy(formSubmissions.status);

    // Get analytics data if available
    const analytics = await db.query.formAnalytics.findFirst({
      where: eq(formAnalytics.formId, formId),
      orderBy: [desc(formAnalytics.date)],
    });

    const totalViews = analytics?.views || 0;
    const conversionRate = totalViews > 0
      ? ((totalSubmissions / totalViews) * 100).toFixed(2)
      : 0;

    return c.json({
      formId,
      formTitle: form.title,
      totalSubmissions,
      totalViews,
      conversionRate: parseFloat(conversionRate as string),
      submissionsByDate: submissionsByDate.map(s => ({
        date: s.date,
        submissions: s.count,
      })),
      submissionsByStatus: submissionsByStatus.map(s => ({
        status: s.status || 'pending',
        count: s.count,
      })),
    });
  } catch (error) {
    console.error('Failed to fetch form analytics:', error);
    return c.json({ error: 'Failed to fetch analytics' }, 500);
  }
});

// GET /analytics/overview - Get user analytics overview
app.get('/overview', async (c) => {
  const userId = c.get('userId');
  const db = createDb(c.env);

  try {
    // Get total forms count
    const totalFormsResult = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(forms)
      .where(eq(forms.userId, userId));

    const totalForms = totalFormsResult[0]?.count || 0;

    // Get total submissions across all user's forms
    const totalSubmissionsResult = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(formSubmissions)
      .innerJoin(forms, eq(formSubmissions.formId, forms.id))
      .where(eq(forms.userId, userId));

    const totalSubmissions = totalSubmissionsResult[0]?.count || 0;

    // Get forms breakdown by status
    const formsByStatus = await db
      .select({
        status: forms.status,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(forms)
      .where(eq(forms.userId, userId))
      .groupBy(forms.status);

    // Get recent submissions (last 7 days) grouped by date
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentSubmissions = await db
      .select({
        date: sql<string>`DATE(${formSubmissions.createdAt})`,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(formSubmissions)
      .innerJoin(forms, eq(formSubmissions.formId, forms.id))
      .where(
        and(
          eq(forms.userId, userId),
          gte(formSubmissions.createdAt, sevenDaysAgo)
        )
      )
      .groupBy(sql`DATE(${formSubmissions.createdAt})`)
      .orderBy(sql`DATE(${formSubmissions.createdAt})`);

    // Get top performing forms (by submission count)
    const topForms = await db
      .select({
        id: forms.id,
        title: forms.title,
        publicId: forms.publicId,
        submissionCount: sql<number>`COUNT(${formSubmissions.id})::int`,
      })
      .from(forms)
      .leftJoin(formSubmissions, eq(forms.id, formSubmissions.formId))
      .where(eq(forms.userId, userId))
      .groupBy(forms.id, forms.title, forms.publicId)
      .orderBy(desc(sql`COUNT(${formSubmissions.id})`))
      .limit(5);

    return c.json({
      totalForms,
      totalSubmissions,
      publishedForms: formsByStatus.find(f => f.status === 'published')?.count || 0,
      draftForms: formsByStatus.find(f => f.status === 'draft')?.count || 0,
      recentSubmissions: recentSubmissions.map(s => ({
        date: s.date,
        count: s.count,
      })),
      topForms: topForms.map(f => ({
        id: f.id,
        title: f.title,
        publicId: f.publicId,
        submissionCount: f.submissionCount,
      })),
    });
  } catch (error) {
    console.error('Failed to fetch analytics overview:', error);
    return c.json({ error: 'Failed to fetch analytics overview' }, 500);
  }
});

export default app;