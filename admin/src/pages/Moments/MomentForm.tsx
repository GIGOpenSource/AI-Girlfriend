/**
 * Moment 新建 / 编辑表单
 *
 * 路由：
 *  - 新建：/moments/new
 *  - 编辑：/moments/:id/edit
 *
 * 逻辑：
 *  1. 通过 useParams 获取 id，有 id 为编辑模式，否则为新建
 *  2. 编辑模式下，调用 GET /api/admin/moments?limit=1000 拉取全部列表，
 *     找到对应 id 的记录并填充表单（companion_id / caption / image_url）
 *  3. 保存时：
 *     - 编辑：PUT /api/admin/moments/:id
 *     - 新建：POST /api/admin/moments
 *  4. 保存成功后跳转回列表页
 */
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { Form, Input, Button, Space, Card, Select, Spin, Upload } from 'antd';
import { ArrowLeftOutlined, UploadOutlined } from '@ant-design/icons';
import { adminFetchJson, adminFetch, showSuccess, showError } from '../../api/request';
import type { CompanionItem } from '../../types';

/**
 * 表单数据结构（与后端字段对应）
 * - id: 主键，仅编辑模式使用
 * - companion_id: 所属 Companion 的 ID
 * - caption: 动态文字内容
 * - image_url: 配图 URL，可为 null（无配图）
 */
interface MomentData {
  id: number;
  companion_id: string;
  caption: string;
  image_url: string | null;
}

export default function MomentForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();  // 从 URL 获取 moment id
  const isEdit = !!id;  // 有 id 则为编辑模式，否则为新建
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);   // 数据加载中（仅编辑模式）
  const [saving, setSaving] = useState(false);     // 保存请求中
  const [companions, setCompanions] = useState<CompanionItem[]>([]); // 智能体列表
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null); // 图片预览 URL
  const [companionsLoading, setCompanionsLoading] = useState(false);  // 智能体列表加载中

  /** 加载智能体列表，供新建时选择 */
  const loadCompanions = useCallback(async () => {
    setCompanionsLoading(true);
    try {
      const list = await adminFetchJson<CompanionItem[]>('/api/admin/companions');
      setCompanions(list || []);
    } catch {
      showError(t('toast.loadFailed') as string);
    } finally {
      setCompanionsLoading(false);
    }
  }, [t]);

  /**
   * 加载已有 moment 数据并填充表单
   * 仅编辑模式下执行，通过列表接口找到对应 id 的记录
   * 使用 useCallback 缓存，避免 useEffect 重复触发
   */
  const loadData = useCallback(async () => {
    if (!isEdit || !id) return;
    setLoading(true);
    try {
      const listRes = await adminFetchJson<{ moments: MomentData[] }>('/api/admin/moments?limit=1000');
      const item = listRes?.moments?.find((m) => String(m.id) === id);
      if (item) {
        form.setFieldsValue({
          companion_id: item.companion_id,
          caption: item.caption,
          image_url: item.image_url || '',
        });
        setPreviewImageUrl(item.image_url || null);
      }
    } catch {
      showError(t('toast.loadFailed') as string);
    } finally {
      setLoading(false);
    }
  }, [form, id, isEdit, t]);

  // 组件挂载时：加载智能体列表；编辑模式额外加载表单数据
  useEffect(() => {
    loadCompanions();
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData, loadCompanions]);

  /**
   * 保存表单
   * 1. 校验表单字段
   * 2. 根据 isEdit 决定调用 PUT（编辑）或 POST（新建）
   * 3. 成功后提示并跳转回列表页
   */
  async function handleSave() {
    const values = await form.validateFields();
    setSaving(true);
    try {
      let res: Response | null;
      if (isEdit) {
        res = await adminFetch(`/api/admin/moments/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values),
        });
      } else {
        res = await adminFetch('/api/admin/moments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values),
        });
      }
      if (res && res.ok) {
        showSuccess(t('toast.saved') as string);
        navigate('/moments');
      } else {
        showError(t('settings.saveFailed') as string);
      }
    } catch {
      showError(t('settings.saveFailed') as string);
    } finally {
      console.log(111)
      setSaving(false);
    }
  }

  return (
    <div>
      {/* 页头：返回按钮 + 标题（新建 / 编辑） */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/moments')}>
          {t('btn.back')}
        </Button>
        <h2 style={{ margin: 0 }}>{isEdit ? t('btn.edit') + ' ' + t('page.moments') : t('btn.new') + ' ' + t('page.moments')}</h2>
      </div>

      {/* 表单卡片：loading 时显示骨架屏 */}
      <Card loading={loading}>
        <Form form={form} layout="vertical">
          {/* companion_id：从智能体列表中选择，必填 */}
          <Form.Item name="companion_id" label={t('table.companion')} rules={[{ required: true, message: '请选择智能体' }]}>
            <Select
              showSearch
              placeholder={companionsLoading ? (t('loading') as string) : '请选择智能体'}
              loading={companionsLoading}
              notFoundContent={companionsLoading ? <Spin size="small" /> : undefined}
              optionFilterProp="label"
              options={companions.map((c) => ({
                value: c.profile.id,
                label: c.profile.name || c.profile.id,
              }))}
            />
          </Form.Item>
          {/* caption：动态文字内容，必填，多行输入 */}
          <Form.Item name="caption" label={t('table.caption')} rules={[{ required: true }]}>
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item name="image_url" label={t('table.image')}>
            <Upload
              listType="picture-card"
              accept="image/*"
              maxCount={1}
              fileList={previewImageUrl ? [{ uid: 'image', name: 'image', status: 'done', url: previewImageUrl }] : []}
              customRequest={({ file, onSuccess, onError }) => {
                const formData = new FormData();
                formData.append('file', file);
                const xhr = new XMLHttpRequest();
                xhr.open('POST', '/api/upload/image');
                xhr.setRequestHeader('Authorization', `Bearer ${localStorage.getItem('admin_token') || ''}`);
                xhr.onload = () => {
                  if (xhr.status === 200) {
                    try {
                      const data = JSON.parse(xhr.responseText);
                      const imagePath = data.url || data.path || '';
                      form.setFieldsValue({ image_url: imagePath });
                      setPreviewImageUrl(imagePath);
                      onSuccess?.(data, file);
                    } catch {
                      onError?.(new Error('Invalid response'));
                    }
                  } else {
                    onError?.(new Error(`HTTP ${xhr.status}`));
                  }
                };
                xhr.onerror = () => {
                  onError?.(new Error('Network error'));
                };
                xhr.send(formData);
              }}
              onRemove={() => {
                form.setFieldsValue({ image_url: '' });
                setPreviewImageUrl(null);
              }}
            >
              {!previewImageUrl && (
                <div>
                  <UploadOutlined />
                  <div style={{ marginTop: 8 }}>{t('btn.upload') || '上传图片'}</div>
                </div>
              )}
            </Upload>
          </Form.Item>
          <Space>
            <Button type="primary" onClick={handleSave} loading={saving}>
              {t('btn.save')}
            </Button>
            <Button onClick={() => navigate('/moments')}>
              {t('btn.cancel')}
            </Button>
          </Space>
        </Form>
      </Card>
    </div>
  );
}
