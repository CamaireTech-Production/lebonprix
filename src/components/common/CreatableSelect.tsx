import { useState } from 'react';
import Select, { components } from 'react-select';
import { Plus } from 'lucide-react';
import { useCategories } from '../../hooks/useFirestore';

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

const Menu = (props: any) => {
  const { children, ...rest } = props;
  
  return (
    <components.Menu {...rest}>
      {children}
      {props.selectProps.inputValue && !props.selectProps.options.find(
        (opt: Option) => opt.label.toLowerCase() === props.selectProps.inputValue.toLowerCase()
      ) && (
        <div 
          className="py-2 px-3 border-t border-gray-200 text-sm text-gray-600 flex items-center cursor-pointer hover:bg-gray-50"
          onClick={() => {
            const input = props.selectProps.inputValue;
            if (input) {
              props.selectProps.onCreateOption(input);
            }
          }}
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
  const { categories, loading, addCategory } = useCategories();
  const [inputValue, setInputValue] = useState("");
  
  const options = categories.map(cat => ({
    label: cat.name,
    value: cat.id
  }));

  const handleCreateOption = async (inputValue: string) => {
    try {
      await addCategory(inputValue);
      setInputValue("");
    } catch (err) {
      console.error('Failed to create category:', err);
      // TODO: Add proper error handling
    }
  };

  if (loading) {
    return (
      <div className="h-9 bg-gray-100 rounded-md animate-pulse" />
    );
  }

  return (
    <Select
      value={value}
      options={options}
      onChange={onChange}
      onInputChange={(newValue) => setInputValue(newValue)}
      inputValue={inputValue}
      onCreateOption={handleCreateOption}
      components={{ Menu }}
      placeholder={placeholder}
      className={className}
      isClearable
      isSearchable
      classNamePrefix="react-select"
    />
  );
};

export default CreatableSelect;