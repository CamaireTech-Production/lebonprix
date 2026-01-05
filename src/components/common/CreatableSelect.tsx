import { useState } from 'react';
import Select, { components, MenuProps, GroupBase } from 'react-select';
import { Plus } from 'lucide-react';
import { useCategories } from '@hooks/data/useFirestore';
import { showErrorToast, showSuccessToast } from '@utils/core/toast';

interface Option {
  label: string;
  value: string;
}

interface CreatableSelectProps {
  value: Option | null;
  onChange: (newValue: Option | null) => void;
  placeholder?: string;
  className?: string;
  options?: Option[];
  onCreate?: (name: string) => Promise<Option | void>;
}

const CreatableSelect = ({
  value,
  onChange,
  placeholder = "Select or create an option...",
  className = "",
  options: customOptions,
  onCreate
}: CreatableSelectProps) => {
  const { categories, addCategory } = useCategories();
  const [inputValue, setInputValue] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const options = customOptions || categories.map(cat => ({
    label: cat.name,
    value: cat.id
  }));

  const handleChange = (newValue: Option | null) => {
    onChange(newValue);
  };

  const handleCreateOption = async (inputValue: string) => {
    if (!inputValue.trim()) {
      showErrorToast('Name cannot be empty');
      return;
    }
    setIsCreating(true);
    try {
      if (onCreate) {
        const newOption = await onCreate(inputValue.trim());
        if (newOption) {
          onChange(newOption);
          showSuccessToast('Created successfully');
        }
      } else {
        const newCategory = await addCategory(inputValue.trim());
        if (newCategory) {
          const newOption = {
            label: newCategory.name,
            value: newCategory.id
          };
          onChange(newOption);
          showSuccessToast('Category created successfully');
        }
      }
    } catch (error: any) {
      showErrorToast(error.message || 'Failed to create');
    } finally {
      setIsCreating(false);
    }
  };

  const CustomMenu = (props: MenuProps<Option, false, GroupBase<Option>>) => {
    const { children, ...rest } = props;

    const handleCreateClick = (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (inputValue) {
        handleCreateOption(inputValue);
      }
    };

    return (
      <components.Menu {...rest}>
        {children}
        {inputValue && !options.find(
          (opt: Option) =>
            opt.label.toLowerCase() === inputValue.toLowerCase()
        ) && (
          <div 
            role="button"
            tabIndex={0}
            className="w-full py-4 px-4 border-t border-gray-200 text-sm text-gray-600 flex items-center justify-center cursor-pointer bg-gray-50 hover:bg-gray-100 active:bg-gray-200 touch-manipulation"
            onClick={handleCreateClick}
            onTouchEnd={handleCreateClick}
            style={{ 
              WebkitTapHighlightColor: 'transparent',
              touchAction: 'manipulation',
              minHeight: '44px' // Minimum touch target size
            }}
          >
            <Plus size={20} className="mr-2" />
            <span className="font-medium">Create "{inputValue}"</span>
          </div>
        )}
      </components.Menu>
    );
  };

  return (
    <Select
      components={{ Menu: CustomMenu }}
      value={value}
      onChange={handleChange}
      options={options}
      inputValue={inputValue}
      onInputChange={setInputValue}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && inputValue) {
          e.preventDefault();
          handleCreateOption(inputValue);
        }
      }}
      placeholder={placeholder}
      className={className }
      isClearable
      isLoading={isCreating}
      isDisabled={isCreating}
      menuIsOpen={isCreating ? false : undefined}
      menuPlacement='auto'
      menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
      styles={{
        menu: (base) => ({
          ...base,
          zIndex: 99999 // Ensure menu is above modal and other elements
        }),
        menuPortal: (base) => ({
          ...base,
          zIndex: 99999
        })
      }}
    />
  );
};

export default CreatableSelect;