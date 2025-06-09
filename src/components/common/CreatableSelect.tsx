import { useState } from 'react';
import Select, { components, MenuProps, GroupBase } from 'react-select';
import { Plus } from 'lucide-react';
import { useCategories } from '../../hooks/useFirestore';
import { showErrorToast, showSuccessToast } from '../../utils/toast';

interface Option {
  label: string;
  value: string;
}

interface CreatableSelectProps {
  value: Option | null;
  onChange: (newValue: Option | null) => void;
  placeholder?: string;
  className?: string;
}

const Menu = (props: MenuProps<Option, false, GroupBase<Option>> & { selectProps: any }) => {
  const { children, ...rest } = props;

  const handleCreateClick = () => {
    const input = props.selectProps.inputValue;
    if (input) {
      props.selectProps.onKeyDown({ key: 'Enter', preventDefault: () => {} });
    }
  };

  return (
    <components.Menu {...rest}>
      {children}
      {props.selectProps.inputValue && !props.selectProps.options.find(
        (opt: Option) =>
          opt.label.toLowerCase() === props.selectProps.inputValue.toLowerCase()
      ) && (
        <div 
          className="py-2 px-3 border-t border-gray-200 text-sm text-gray-600 flex items-center cursor-pointer hover:bg-gray-50"
          onClick={handleCreateClick}
        >
          <Plus size={16} className="mr-2" />
          Create "{props.selectProps.inputValue}"
        </div>
      )}
    </components.Menu>
  );
};

const CreatableSelect = ({
  value,
  onChange,
  placeholder = "Select or create a category...",
  className = ""
}: CreatableSelectProps) => {
  const { categories, addCategory } = useCategories();
  const [inputValue, setInputValue] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const options = categories.map(cat => ({
    label: cat.name,
    value: cat.id
  }));

  const handleChange = (newValue: Option | null) => {
    onChange(newValue);
  };

  const handleCreateOption = async (inputValue: string) => {
    if (!inputValue.trim()) {
      showErrorToast('Category name cannot be empty');
      return;
    }

    try {
      setIsCreating(true);
      const newCategory = await addCategory(inputValue.trim());
      if (newCategory) {
        const newOption = {
          label: newCategory.name,
          value: newCategory.id
        };
        onChange(newOption);
        showSuccessToast('Category created successfully');
      }
    } catch (error: any) {
      console.error('Failed to create category:', error);
      showErrorToast(error.message || 'Failed to create category');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Select
      components={{ Menu }}
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
      className={className}
      isClearable
      isLoading={isCreating}
      isDisabled={isCreating}
    />
  );
};

export default CreatableSelect;