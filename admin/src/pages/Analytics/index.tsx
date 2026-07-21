import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StatisticCard } from '@ant-design/pro-card';
import ProTable from '@ant-design/pro-table';
import { Row, Col, Spin, DatePicker, Button, Space, Select } from 'antd';
import { BarChartOutlined, AreaChartOutlined, DownloadOutlined } from '@ant-design/icons';
import { adminFetchJson, adminFetch, showError } from '../../api/request';
import type {
  AnalyticsPageViewItem,
  AnalyticsButtonClickItem,
  AnalyticsSummary,
  DauSeriesItem,
  RetentionCohortRow,
  RetentionPayload,
} from '../../types';

const { RangePicker } = DatePicker;

export default function Analytics() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [pageViews, setPageViews] = useState<AnalyticsPageViewItem[]>([]);
  const [buttonClicks, setButtonClicks] = useState<AnalyticsButtonClickItem[]>([]);
  const [summary, setSummary] = useState<AnalyticsSummary>({
    total_pv: 0,
    total_uv: 0,
    total_clicks: 0,
    total_button_uv: 0,
  });
  const [dauSeries, setDauSeries] = useState<DauSeriesItem[]>([]);
  const [retention, setRetention] = useState<RetentionPayload | null>(null);
  const [dates, setDates] = useState<[string, string] | null>(null);
  const [language, setLanguage] = useState<string | null>(null);
  const [dauSorter, setDauSorter] = useState<{ field: keyof DauSeriesItem; order: 'ascend' | 'descend' } | null>({ field: 'dau', order: 'descend' });
  const [pageViewSorter, setPageViewSorter] = useState<{ field: keyof AnalyticsPageViewItem; order: 'ascend' | 'descend' } | null>({ field: 'pv_count', order: 'descend' });
  const [buttonClickSorter, setButtonClickSorter] = useState<{ field: keyof AnalyticsButtonClickItem; order: 'ascend' | 'descend' } | null>({ field: 'click_count', order: 'descend' });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page_views', '1');
      params.append('button_clicks', '1');
      params.append('include_dau', '1');
      params.append('include_retention', '1');
      if (dates) {
        params.append('start_date', dates[0]);
        params.append('end_date', dates[1]);
      }
      if (language) {
        params.append('language', language);
      }
      const res = await adminFetchJson<{
        page_views?: AnalyticsPageViewItem[];
        button_clicks?: AnalyticsButtonClickItem[];
        page_summary?: { total_pv: number; total_uv: number };
        button_summary?: { total_clicks: number; total_uv: number };
        dau_series?: DauSeriesItem[];
        retention?: RetentionPayload;
      }>(`/api/admin/analytics?${params.toString()}`);
      if (res) {
        setPageViews((res.page_views || []).map((item) => ({
          ...item,
          pv_count: Number(item.pv_count),
          uv_count: Number(item.uv_count),
        })));
        setButtonClicks((res.button_clicks || []).map((item) => ({
          ...item,
          click_count: Number(item.click_count),
          uv_count: Number(item.uv_count),
        })));
        setDauSeries(res.dau_series || []);
        setRetention(res.retention || null);
        setSummary({
          total_pv: res.page_summary?.total_pv || 0,
          total_uv: res.page_summary?.total_uv || 0,
          total_clicks: res.button_summary?.total_clicks || 0,
          total_button_uv: res.button_summary?.total_uv || 0,
        });
      }
    } catch {
      showError(t('toast.loadFailed') as string);
    } finally {
      setLoading(false);
    }
  }, [dates, language, t]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const getSortedData = <T extends object>(
    data: T[],
    sorter: { field: keyof T; order: 'ascend' | 'descend' } | null
  ): T[] => {
    if (!sorter || !data.length) return [...data];
    return [...data].sort((a, b) => {
      const valA = a[sorter.field];
      const valB = b[sorter.field];
      const numA = typeof valA === 'number' ? valA : Number(valA) || 0;
      const numB = typeof valB === 'number' ? valB : Number(valB) || 0;
      return sorter.order === 'ascend' ? numA - numB : numB - numA;
    });
  };

  const handleExport = async (type: 'all' | 'page_views' | 'button_clicks' | 'dau' | 'retention') => {
    try {
      const params = new URLSearchParams();
      params.append('type', type);
      if (dates) {
        params.append('start_date', dates[0]);
        params.append('end_date', dates[1]);
      }
      if (language) {
        params.append('language', language);
      }
      const res = await adminFetch(`/api/admin/analytics/export?${params.toString()}`);
      if (!res || !res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const filename = res.headers.get('content-disposition')?.match(/filename="(.+)"/)?.[1] || 'analytics.xlsx';
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      showError(t('toast.loadFailed') as string);
    }
  };

  if (loading && pageViews.length === 0 && buttonClicks.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <h2>{t('page.analytics')}</h2>

      <Space style={{ marginTop: 16, marginBottom: 16 }} wrap>
        <RangePicker
          onChange={(vals) => {
            if (vals && vals[0] && vals[1]) {
              setDates([vals[0].format('YYYY-MM-DD'), vals[1].format('YYYY-MM-DD')]);
            } else {
              setDates(null);
            }
          }}
        />
        <Select
          placeholder={t('table.language') as string}
          allowClear
          style={{ width: 120 }}
          value={language}
          onChange={(val) => setLanguage(val || null)}
          options={[
            { label: '中文', value: 'zh' },
            { label: 'English', value: 'en' },
            { label: '日本語', value: 'ja' },
            { label: '한국어', value: 'ko' },
            { label: 'Português', value: 'pt' },
            { label: 'Español', value: 'es' },
            { label: 'Bahasa Indonesia', value: 'id' },
          ]}
        />
        <Button icon={<DownloadOutlined />} onClick={() => handleExport('all')}>
          {t('btn.exportExcel')}
        </Button>
        <Button icon={<DownloadOutlined />} onClick={() => handleExport('dau')}>
          {t('analytics.exportDau')}
        </Button>
        <Button icon={<DownloadOutlined />} onClick={() => handleExport('retention')}>
          {t('analytics.exportRetention')}
        </Button>
      </Space>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <StatisticCard
            statistic={{
              title: t('stat.totalPv'),
              value: summary.total_pv,
              icon: <BarChartOutlined style={{ fontSize: 24 }} />,
            }}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatisticCard
            statistic={{
              title: t('stat.totalUv'),
              value: summary.total_uv,
              icon: <BarChartOutlined style={{ fontSize: 24 }} />,
            }}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatisticCard
            statistic={{
              title: t('stat.totalClicks'),
              value: summary.total_clicks,
              icon: <AreaChartOutlined style={{ fontSize: 24 }} />,
            }}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatisticCard
            statistic={{
              title: t('stat.totalButtonUv'),
              value: summary.total_button_uv,
              icon: <AreaChartOutlined style={{ fontSize: 24 }} />,
            }}
          />
        </Col>
      </Row>

      <h3 style={{ marginBottom: 16 }}>{t('analytics.dauTitle')}</h3>
      <ProTable<DauSeriesItem>
        rowKey="date"
        dataSource={getSortedData(dauSeries, dauSorter)}
        loading={loading}
        search={false}
        pagination={{ pageSize: 15, showSizeChanger: true }}
        onChange={(_, __, sorter) => {
          let field: keyof DauSeriesItem | undefined;
          let order: 'ascend' | 'descend' | undefined;
          if (Array.isArray(sorter) && sorter.length > 0) {
            field = sorter[0].field as keyof DauSeriesItem;
            order = sorter[0].order;
          } else if (sorter && !Array.isArray(sorter)) {
            field = sorter.field as keyof DauSeriesItem;
            order = sorter.order;
          }
          if (!field) return;
          if (order) {
            setDauSorter({ field, order });
          }
        }}
        columns={[
          { title: t('analytics.dauDate'), dataIndex: 'date', key: 'date' },
          {
            title: t('analytics.dauCount'),
            dataIndex: 'dau',
            key: 'dau',
            sorter: true,
            sortOrder: dauSorter?.field === 'dau' ? dauSorter.order : undefined,
          },
        ]}
      />

      <h3 style={{ marginTop: 32, marginBottom: 16 }}>{t('analytics.retentionTitle')}</h3>
      <p style={{ color: '#666', marginBottom: 12 }}>{retention?.note || t('analytics.retentionHint')}</p>
      <ProTable<RetentionCohortRow>
        rowKey="cohort_date"
        dataSource={retention?.cohorts || []}
        loading={loading}
        search={false}
        scroll={{ x: 900 }}
        pagination={{ pageSize: 15, showSizeChanger: true }}
        columns={[
          { title: t('analytics.cohortDate'), dataIndex: 'cohort_date', key: 'cohort_date', width: 120 },
          {
            title: t('analytics.newUsers'),
            dataIndex: 'new_users',
            key: 'new_users',
            width: 100,
            sorter: (a, b) => a.new_users - b.new_users,
          },
          {
            title: t('analytics.retentionD1'),
            key: 'd1',
            render: (_: unknown, r: RetentionCohortRow) =>
              r.new_users > 0 ? `${r.retention_pct?.d1 ?? 0}% (${r.retention_counts?.d1 ?? 0})` : '—',
          },
          {
            title: t('analytics.retentionD3'),
            key: 'd3',
            render: (_: unknown, r: RetentionCohortRow) =>
              r.new_users > 0 ? `${r.retention_pct?.d3 ?? 0}% (${r.retention_counts?.d3 ?? 0})` : '—',
          },
          {
            title: t('analytics.retentionD7'),
            key: 'd7',
            render: (_: unknown, r: RetentionCohortRow) =>
              r.new_users > 0 ? `${r.retention_pct?.d7 ?? 0}% (${r.retention_counts?.d7 ?? 0})` : '—',
          },
          {
            title: t('analytics.retentionD30'),
            key: 'd30',
            render: (_: unknown, r: RetentionCohortRow) =>
              r.new_users > 0 ? `${r.retention_pct?.d30 ?? 0}% (${r.retention_counts?.d30 ?? 0})` : '—',
          },
        ]}
      />

      <h3 style={{ marginTop: 32, marginBottom: 16 }}>{t('analytics.pageViews')}</h3>
      <ProTable<AnalyticsPageViewItem>
        rowKey="page_path"
        dataSource={getSortedData(pageViews, pageViewSorter)}
        loading={loading}
        search={false}
        pagination={{ pageSize: 10 }}
        onChange={(_, __, sorter) => {
          let field: keyof AnalyticsPageViewItem | undefined;
          let order: 'ascend' | 'descend' | undefined;
          if (Array.isArray(sorter) && sorter.length > 0) {
            field = sorter[0].field as keyof AnalyticsPageViewItem;
            order = sorter[0].order;
          } else if (sorter && !Array.isArray(sorter)) {
            field = sorter.field as keyof AnalyticsPageViewItem;
            order = sorter.order;
          }
          if (!field) return;
          if (order) {
            setPageViewSorter({ field, order });
          }
        }}
        columns={[
          { title: t('table.pagePath'), dataIndex: 'page_path', key: 'page_path' },
          { title: t('table.pageName'), dataIndex: 'page_name', key: 'page_name' },
          { title: t('table.language'), dataIndex: 'language', key: 'language' },
          {
            title: t('table.pvCount'),
            dataIndex: 'pv_count',
            key: 'pv_count',
            sorter: true,
            sortOrder: pageViewSorter?.field === 'pv_count' ? pageViewSorter.order : undefined,
          },
          {
            title: t('table.uvCount'),
            dataIndex: 'uv_count',
            key: 'uv_count',
            sorter: true,
            sortOrder: pageViewSorter?.field === 'uv_count' ? pageViewSorter.order : undefined,
          },
        ]}
        toolBarRender={() => [
          <Button key="export-pv" icon={<DownloadOutlined />} onClick={() => handleExport('page_views')}>
            {t('btn.exportExcel')}
          </Button>,
        ]}
      />

      <h3 style={{ marginTop: 32, marginBottom: 16 }}>{t('analytics.buttonClicks')}</h3>
      <ProTable<AnalyticsButtonClickItem>
        rowKey="button_id"
        dataSource={getSortedData(buttonClicks, buttonClickSorter)}
        loading={loading}
        search={false}
        pagination={{ pageSize: 10 }}
        onChange={(_, __, sorter) => {
          let field: keyof AnalyticsButtonClickItem | undefined;
          let order: 'ascend' | 'descend' | undefined;
          if (Array.isArray(sorter) && sorter.length > 0) {
            field = sorter[0].field as keyof AnalyticsButtonClickItem;
            order = sorter[0].order;
          } else if (sorter && !Array.isArray(sorter)) {
            field = sorter.field as keyof AnalyticsButtonClickItem;
            order = sorter.order;
          }
          if (!field) return;
          if (order) {
            setButtonClickSorter({ field, order });
          }
        }}
        columns={[
          { title: t('table.buttonId'), dataIndex: 'button_id', key: 'button_id' },
          { title: t('table.buttonName'), dataIndex: 'button_name', key: 'button_name' },
          { title: t('table.page'), dataIndex: 'page_path', key: 'page_path' },
          { title: t('table.language'), dataIndex: 'language', key: 'language' },
          {
            title: t('table.clickCount'),
            dataIndex: 'click_count',
            key: 'click_count',
            sorter: true,
            sortOrder: buttonClickSorter?.field === 'click_count' ? buttonClickSorter.order : undefined,
          },
          {
            title: t('table.uvCount'),
            dataIndex: 'uv_count',
            key: 'uv_count',
            sorter: true,
            sortOrder: buttonClickSorter?.field === 'uv_count' ? buttonClickSorter.order : undefined,
          },
        ]}
        toolBarRender={() => [
          <Button key="export-bc" icon={<DownloadOutlined />} onClick={() => handleExport('button_clicks')}>
            {t('btn.exportExcel')}
          </Button>,
        ]}
      />
    </div>
  );
}
