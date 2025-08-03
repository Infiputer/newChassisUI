import React, { useState, useEffect } from 'react';
import { Model } from '../types';
import { apiService } from '../services/api';
import { Edit, Trash2, Plus, Settings, ExternalLink } from 'lucide-react';
import ModelCreationForm from './ModelCreationForm';

const ModelManagement: React.FC = () => {
  const [userModels, setUserModels] = useState<Model[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingModel, setEditingModel] = useState<Model | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    loadUserModels();
  }, []);

  const loadUserModels = async () => {
    try {
      setIsLoading(true);
      const models = await apiService.getUserModels();
      setUserModels(models);
    } catch (error) {
      console.error('Error loading user models:', error);
      setError('Failed to load your models');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteModel = async (modelId: string) => {
    if (!window.confirm('Are you sure you want to delete this model? This action cannot be undone.')) {
      return;
    }

    try {
      await apiService.deleteModel(modelId);
      setUserModels(userModels.filter(model => model.model_id !== modelId));
    } catch (error) {
      console.error('Error deleting model:', error);
      setError('Failed to delete model');
    }
  };

  const handleModelCreated = () => {
    setShowCreateForm(false);
    loadUserModels();
  };

  const handleModelUpdated = () => {
    setEditingModel(null);
    loadUserModels();
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Models</h1>
          <p className="text-gray-600 mt-1">Manage your custom AI models</p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={16} />
          Create Model
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
          {error}
        </div>
      )}

      {userModels.length === 0 ? (
        <div className="text-center py-12">
          <Settings className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2 dark:text-white">No models yet</h3>
          <p className="text-gray-600 mb-6">
            Create your first custom AI model to get started
          </p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="btn-primary"
          >
            Create Your First Model
          </button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {userModels.map((model) => (
            <div
              key={model.model_id}
              className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1 dark:text-white">
                    {model.name}
                  </h3>
                  {model.short_description && (
                    <p className="text-sm text-gray-600 mb-2">
                      {model.short_description}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingModel(model)}
                    className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                    title="Edit model"
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    onClick={() => handleDeleteModel(model.model_id)}
                    className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                    title="Delete model"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {model.description && (
                <p className="text-sm text-gray-700 mb-4 line-clamp-2">
                  {model.description}
                </p>
              )}

              {model.endpoints && model.endpoints.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white">Endpoints</h4>
                  <div className="space-y-1">
                    {model.endpoints.map((endpoint, index) => (
                      <div
                        key={endpoint.id || index}
                        className="flex items-center justify-between text-xs bg-gray-50 px-2 py-1 rounded"
                      >
                        <span className="text-gray-600 truncate flex-1">
                          {endpoint.url}
                        </span>
                        <span className="text-gray-500 ml-2">
                          w:{endpoint.weight}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Created {new Date(model.created_at).toLocaleDateString()}</span>
                  <span className="flex items-center gap-1">
                    <ExternalLink size={12} />
                    {model.endpoints?.length || 0} endpoints
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Model Form */}
      {showCreateForm && (
        <ModelCreationForm
          onClose={() => setShowCreateForm(false)}
          onSuccess={handleModelCreated}
        />
      )}

      {/* Edit Model Form */}
      {editingModel && (
        <ModelCreationForm
          onClose={() => setEditingModel(null)}
          onSuccess={handleModelUpdated}
          editingModel={editingModel}
        />
      )}
    </div>
  );
};

export default ModelManagement; 