import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import IVRCanvas from '../components/IVRCanvas';

const IVREditorPage: React.FC = () => {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const [ivrData, setIvrData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (name) {
      axios.get(`/api/ivrs/${name}`)
        .then(res => {
          setIvrData(res.data);
          setLoading(false);
        })
        .catch(() => {
          // If IVR doesn't exist yet, use defaults
          setIvrData({
            name,
            flow: { nodes: {}, rootHead: null },
            status: 'draft',
          });
          setLoading(false);
        });
    }
  }, [name]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-muted/30">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <IVRCanvas
      name={name || 'new-ivr'}
      initialData={ivrData}
      allAgents={['services', 'offers', 'meetings', 'support', 'other']}
      onSave={async (data) => {
        try {
          await axios.put(`/api/ivrs/${name}`, {
            ...ivrData,
            name,
            flow: data.flow,
            status: data.status,
          });
          toast.success('IVR saved!');
        } catch (err: any) {
          toast.error(err.response?.data?.detail || 'Failed to save IVR');
        }
      }}
      onBack={() => navigate('/ivrs')}
    />
  );
};

export default IVREditorPage;
