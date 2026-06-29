import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface MetricsData {
  totalReports: number;
  resolvedReports: number;
  pendingReports: number;
  averageResolutionDays: number;
  reportsByStatus: { status: string; count: number; percentage: number }[];
  reportsByPriority: { priority: string; count: number; percentage: number }[];
  reportsByType: { type: string; count: number }[];
  reportsByCategory: { category: string; count: number }[];
  reportsByArea: { area: string; count: number }[];
  reportsByProject: { project: string; count: number }[];
  topReporters: { user: string; count: number; avatar?: string }[];
  topResponsibles: { user: string; count: number; pending: number }[];
  timeline: { date: string; count: number; unsafe_acts: number; unsafe_conditions: number }[];
  previousPeriodComparison: number;
}

export function useMetrics(startDate: Date, endDate: Date, companyId: string) {
  const [data, setData] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (companyId) {
      fetchMetrics();
    }
  }, [startDate, endDate, companyId]);

  async function fetchMetrics() {
    try {
      setLoading(true);
      setError(null);

      const { data: reports, error: reportsError } = await supabase
        .from('reports')
        .select('*')
        .eq('company_id', companyId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (reportsError) throw reportsError;

      const reporterIds = [...new Set(reports?.map(r => r.reporter_id).filter(Boolean))];
      const responsibleIds = [...new Set(reports?.map(r => r.responsible_id).filter(Boolean))];
      const allUserIds = [...new Set([...reporterIds, ...responsibleIds])];

      let usersMap = new Map();
      if (allUserIds.length > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('id, full_name, dni')
          .in('id', allUserIds);

        usersMap = new Map(users?.map(u => [u.id, u]) || []);
      }

      const totalReports = reports?.length || 0;
      const resolvedReports = reports?.filter(r => r.status === 'closed').length || 0;
      const pendingReports = reports?.filter(r => r.status !== 'closed').length || 0;

      const closedReports = reports?.filter(r => r.status === 'closed' && r.closed_at) || [];
      const avgResolution = closedReports.length > 0
        ? closedReports.reduce((sum, r) => {
            const created = new Date(r.created_at);
            const closed = new Date(r.closed_at!);
            return sum + (closed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
          }, 0) / closedReports.length
        : 0;

      const statusCounts = reports?.reduce((acc, r) => {
        const key = r.status || 'reported';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      const reportsByStatus = Object.entries(statusCounts).map(([status, count]) => ({
        status,
        count,
        percentage: totalReports > 0 ? (count / totalReports) * 100 : 0
      }));

      const priorityCounts = reports?.reduce((acc, r) => {
        const key = r.priority || 'medium';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      const reportsByPriority = Object.entries(priorityCounts).map(([priority, count]) => ({
        priority,
        count,
        percentage: totalReports > 0 ? (count / totalReports) * 100 : 0
      }));

      const typeCounts = reports?.reduce((acc, r) => {
        const key = r.type || 'unsafe_condition';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      const reportsByType = Object.entries(typeCounts).map(([type, count]) => ({
        type,
        count
      }));

      const categoryIds = [...new Set(reports?.map(r => r.category_id).filter(Boolean))];

      let categoriesMap = new Map();
      if (categoryIds.length > 0) {
        const { data: categories } = await supabase
          .from('categories')
          .select('id, name')
          .in('id', categoryIds);

        categoriesMap = new Map(categories?.map(c => [c.id, c.name]) || []);
      }

      const categoryCounts = reports?.reduce((acc, r) => {
        const categoryName = r.category_id ? categoriesMap.get(r.category_id) || 'Sin categoría' : 'Sin categoría';
        acc[categoryName] = (acc[categoryName] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      const reportsByCategory = Object.entries(categoryCounts)
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      const areaCounts = reports?.reduce((acc, r) => {
        if (r.area_proyecto) {
          acc[r.area_proyecto] = (acc[r.area_proyecto] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>) || {};

      const reportsByArea = Object.entries(areaCounts)
        .map(([area, count]) => ({ area, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      const projectCounts = reports?.reduce((acc, r) => {
        if (r.area_proyecto && r.area_proyecto.includes('/')) {
          const project = r.area_proyecto.split('/')[1];
          acc[project] = (acc[project] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>) || {};

      const reportsByProject = Object.entries(projectCounts)
        .map(([project, count]) => ({ project, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      const reporterCounts = reports?.reduce((acc, r) => {
        const reporter = r.reporter_id ? usersMap.get(r.reporter_id) : null;
        const key = reporter?.full_name || reporter?.dni || 'Anónimo';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      const topReporters = Object.entries(reporterCounts)
        .map(([user, count]) => ({ user, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      const responsibleCounts = reports?.reduce((acc, r) => {
        if (r.responsible_id) {
          const responsible = usersMap.get(r.responsible_id);
          const key = responsible?.full_name || responsible?.dni || 'Sin nombre';
          if (!acc[key]) {
            acc[key] = { total: 0, pending: 0 };
          }
          acc[key].total = (acc[key].total || 0) + 1;
          if (r.status !== 'closed') {
            acc[key].pending = (acc[key].pending || 0) + 1;
          }
        }
        return acc;
      }, {} as Record<string, { total: number; pending: number }>) || {};

      const topResponsibles = Object.entries(responsibleCounts)
        .map(([user, data]) => ({ user, count: data.total, pending: data.pending }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      const timelineMap = reports?.reduce((acc, r) => {
        const date = new Date(r.created_at).toISOString().split('T')[0];
        if (!acc[date]) {
          acc[date] = { count: 0, unsafe_acts: 0, unsafe_conditions: 0 };
        }
        acc[date].count = (acc[date].count || 0) + 1;
        if (r.type === 'unsafe_act') acc[date].unsafe_acts = (acc[date].unsafe_acts || 0) + 1;
        if (r.type === 'unsafe_condition') acc[date].unsafe_conditions = (acc[date].unsafe_conditions || 0) + 1;
        return acc;
      }, {} as Record<string, { count: number; unsafe_acts: number; unsafe_conditions: number }>) || {};

      const timeline = Object.entries(timelineMap)
        .map(([date, data]) => ({
          date,
          count: data.count,
          unsafe_acts: data.unsafe_acts,
          unsafe_conditions: data.unsafe_conditions
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const previousStart = new Date(startDate);
      previousStart.setDate(previousStart.getDate() - (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

      const { data: previousReports } = await supabase
        .from('reports')
        .select('id')
        .eq('company_id', companyId)
        .gte('created_at', previousStart.toISOString())
        .lt('created_at', startDate.toISOString());

      const previousCount = previousReports?.length || 0;
      const previousPeriodComparison = previousCount > 0
        ? ((totalReports - previousCount) / previousCount) * 100
        : totalReports > 0 ? 100 : 0;

      setData({
        totalReports,
        resolvedReports,
        pendingReports,
        averageResolutionDays: avgResolution,
        reportsByStatus,
        reportsByPriority,
        reportsByType,
        reportsByCategory,
        reportsByArea,
        reportsByProject,
        topReporters,
        topResponsibles,
        timeline,
        previousPeriodComparison
      });
    } catch (err) {
      console.error('Error fetching metrics:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar métricas');
    } finally {
      setLoading(false);
    }
  }

  return { data, loading, error, refetch: fetchMetrics };
}
