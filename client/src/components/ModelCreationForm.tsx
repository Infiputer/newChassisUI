import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, X } from 'lucide-react';
import { Model } from '../types';
import { apiService } from '../services/api';

interface Endpoint {
  url: string;
  weight: number;
}

interface ModelCreationFormProps {
  onClose: () => void;
  onSuccess: () => void;
  editingModel?: Model | null;
}

const ModelCreationForm: React.FC<ModelCreationFormProps> = ({ onClose, onSuccess, editingModel }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    short_description: '',
    long_description: ''
  });
  const [endpoints, setEndpoints] = useState<Endpoint[]>([
    { url: '', weight: 1 }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Initialize form with editing model data
  useEffect(() => {
    if (editingModel) {
      setFormData({
        name: editingModel.name,
        description: editingModel.description || '',
        short_description: editingModel.short_description || '',
        long_description: editingModel.long_description || ''
      });
      
      if (editingModel.endpoints && editingModel.endpoints.length > 0) {
        setEndpoints(editingModel.endpoints.map(ep => ({
          url: ep.url,
          weight: ep.weight
        })));
      }
    }
  }, [editingModel]);

  const addEndpoint = () => {
    setEndpoints([...endpoints, { url: '', weight: 1 }]);
  };

  const removeEndpoint = (index: number) => {
    if (endpoints.length > 1) {
      setEndpoints(endpoints.filter((_, i) => i !== index));
    }
  };

  const updateEndpoint = (index: number, field: keyof Endpoint, value: string | number) => {
    const newEndpoints = [...endpoints];
    newEndpoints[index] = { ...newEndpoints[index], [field]: value };
    setEndpoints(newEndpoints);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      // Validate form
      if (!formData.name.trim()) {
        throw new Error('Model name is required');
      }

      if (endpoints.some(ep => !ep.url.trim())) {
        throw new Error('All endpoints must have a URL');
      }

      if (endpoints.some(ep => ep.weight <= 0)) {
        throw new Error('All endpoint weights must be greater than 0');
      }

      const modelData = {
        ...formData,
        endpoints: endpoints.map(ep => ({
          url: ep.url.trim(),
          weight: parseInt(ep.weight.toString())
        }))
      };

      if (editingModel) {
        // Update existing model
        await apiService.updateModel(editingModel.model_id, modelData);
      } else {
        // Create new model
        await apiService.createModel(modelData);
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalWeight = endpoints.reduce((sum, ep) => sum + ep.weight, 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            {editingModel ? 'Edit Model' : 'Create New Model'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Model Information */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Model Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., My Custom GPT Model"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Short Description
              </label>
              <input
                type="text"
                value={formData.short_description}
                onChange={(e) => setFormData({ ...formData, short_description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Brief description (optional)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Detailed description of your model (optional)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Long Description
              </label>
              <textarea
                value={formData.long_description}
                onChange={(e) => setFormData({ ...formData, long_description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={4}
                placeholder="Comprehensive description with capabilities, use cases, etc. (optional)"
              />
            </div>
          </div>

          {/* Endpoints Section */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Endpoints</h3>
              <button
                type="button"
                onClick={addEndpoint}
                className="flex items-center gap-2 px-3 py-1 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600"
              >
                <Plus size={16} />
                Add Endpoint
              </button>
            </div>

            <div className="space-y-3">
              {endpoints.map((endpoint, index) => (
                <div key={index} className="flex gap-3 items-start p-3 border border-gray-200 rounded-md">
                  <div className="flex-1 space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Endpoint URL *
                    </label>
                    <input
                      type="url"
                      value={endpoint.url}
                      onChange={(e) => updateEndpoint(index, 'url', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="https://api.example.com/v1/chat/completions"
                      required
                    />
                  </div>
                  
                  <div className="w-24 space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Weight
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={endpoint.weight}
                      onChange={(e) => updateEndpoint(index, 'weight', parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  {endpoints.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeEndpoint(index)}
                      className="mt-6 p-2 text-red-500 hover:text-red-700"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Weight Distribution Info */}
            <div className="bg-blue-50 p-3 rounded-md">
              <p className="text-sm text-blue-800">
                <strong>Weight Distribution:</strong> Total weight: {totalWeight}. 
                Endpoints with higher weights will receive more requests for load balancing.
              </p>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
              {error}
            </div>
          )}

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
            >
              <Save size={16} />
              {isSubmitting 
                ? (editingModel ? 'Updating...' : 'Creating...') 
                : (editingModel ? 'Update Model' : 'Create Model')
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ModelCreationForm; 