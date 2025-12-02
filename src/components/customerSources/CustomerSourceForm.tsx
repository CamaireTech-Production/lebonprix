import { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Input from '../common/Input';
import Textarea from '../common/Textarea';
import { showErrorToast } from '../../utils/toast';
import type { CustomerSource } from '../../types/models';

interface CustomerSourceFormProps {
  source?: CustomerSource | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (sourceData: Omit<CustomerSource, 'id' | 'createdAt' | 'updatedAt' | 'userId' | 'companyId'>) => Promise<void>;
}

const CustomerSourceForm = ({ source, isOpen, onClose, onSave }: CustomerSourceFormProps) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#3B82F6'); // Default blue color
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (source) {
      setName(source.name);
      setDescription(source.description || '');
      setColor(source.color || '#3B82F6');
      setIsActive(source.isActive !== undefined ? source.isActive : true);
    } else {
      // Reset form for new source
      setName('');
      setDescription('');
      setColor('#3B82F6');
      setIsActive(true);
    }
  }, [source, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      showErrorToast('Le nom de la source est requis');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || undefined,
        color: color || undefined,
        isActive
      });
      onClose();
    } catch (error) {
      console.error('Error saving customer source:', error);
      showErrorToast('Erreur lors de la sauvegarde de la source');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isEditing = !!source;

  // Predefined color options
  const colorOptions = [
    { value: '#3B82F6', label: 'Bleu', color: '#3B82F6' },
    { value: '#10B981', label: 'Vert', color: '#10B981' },
    { value: '#F59E0B', label: 'Orange', color: '#F59E0B' },
    { value: '#EF4444', label: 'Rouge', color: '#EF4444' },
    { value: '#8B5CF6', label: 'Violet', color: '#8B5CF6' },
    { value: '#EC4899', label: 'Rose', color: '#EC4899' },
    { value: '#06B6D4', label: 'Cyan', color: '#06B6D4' },
    { value: '#84CC16', label: 'Lime', color: '#84CC16' },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Modifier la source' : 'Créer une source clientelle'}
      footer={
        <div className="flex justify-end space-x-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !name.trim()}
          >
            {isSubmitting ? 'Enregistrement...' : isEditing ? 'Modifier' : 'Créer'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nom de la source <span className="text-red-500">*</span>
          </label>
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: TikTok, Facebook, Influenceur..."
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description optionnelle de la source"
            rows={3}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Couleur
          </label>
          <div className="flex items-center gap-4">
            <div className="flex gap-2 flex-wrap">
              {colorOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setColor(option.value)}
                  className={`w-10 h-10 rounded-lg border-2 transition-all ${
                    color === option.value
                      ? 'border-gray-900 scale-110'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                  style={{ backgroundColor: option.color }}
                  title={option.label}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-12 h-12 rounded border border-gray-300 cursor-pointer"
              />
              <span className="text-sm text-gray-600">Personnalisée</span>
            </div>
          </div>
        </div>

        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
            />
            <span className="text-sm font-medium text-gray-700">Source active</span>
          </label>
          <p className="text-xs text-gray-500 mt-1 ml-6">
            Les sources inactives ne seront pas disponibles dans les formulaires de vente
          </p>
        </div>
      </form>
    </Modal>
  );
};

export default CustomerSourceForm;





