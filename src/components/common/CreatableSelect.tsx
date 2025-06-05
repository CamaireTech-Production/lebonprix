import { useState } from 'react';
import Select, { components, MenuProps } from 'react-select';
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

const Menu = (props: MenuProps<Option, false> & { selectProps: any }) => {
  const { children, ...rest } = props;

  return (
    <components.Menu {...rest}>
      {children}
      {props.selectProps.inputValue && !props.selectProps.options.find(
        (opt: Option) =>
          opt.label.toLowerCase() === props.selectProps.inputValue.toLowerCase()
      ) && (
        <div 
          className="py-2 px-3 border-t border-gray-200 text-sm text-gray-600 flex items-center cursor-pointer hover:bg-gray-50"
          onClick={() => {
            const input = props.selectProps.inputValue;
            if (input && props.selectProps.onCustomCreateOption) {
              props.selectProps.onCustomCreateOption(input);
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
  const { categories } = useCategories();
  const [inputValue, setInputValue] = useState("");

  const options = categories.map(cat => ({
    label: cat.name,
    value: cat.id
  }));

  const handleChange = (newValue: Option | null) => {
    onChange(newValue);
  };

  return (
    <Select
      components={{ Menu }}
      value={value}
      onChange={handleChange}
      options={options}
      inputValue={inputValue}
      onInputChange={setInputValue}
      placeholder={placeholder}
      className={className}
      isClearable
    />
  );
};

export default CreatableSelect;