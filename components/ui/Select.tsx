import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  TextInput,
} from "react-native";
import { ChevronDown, Search, Check } from "lucide-react-native";

interface SelectOption {
  label: string;
  value: string;
}

interface SelectProps {
  label: string;
  value: string;
  options: SelectOption[];
  onSelect: (value: string) => void;
  placeholder?: string;
  error?: string;
  searchable?: boolean;
  isDark?: boolean;
}

export function Select({
  label,
  value,
  options,
  onSelect,
  placeholder = "Select...",
  error,
  searchable = false,
  isDark = true,
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedOption = options.find((o) => o.value === value);
  const filteredOptions = searchable
    ? options.filter((o) =>
        o.label.toLowerCase().includes(search.toLowerCase())
      )
    : options;

  const bgColor = isDark ? "bg-[#1C1C1E]" : "bg-[#F9FAFB]";
  const textColor = isDark ? "text-white" : "text-[#1A1A1A]";
  const labelColor = isDark ? "text-[#A1A1AA]" : "text-[#6B7280]";
  const mutedColor = isDark ? "#71717A" : "#9CA3AF";
  const modalBg = isDark ? "bg-[#18181B]" : "bg-white";
  const itemBg = isDark ? "bg-[#1C1C1E]" : "bg-[#F3F4F6]";
  const borderColor = error ? "border-red-500" : "border-transparent";

  return (
    <View className="mb-4">
      <Text className={`${labelColor} text-sm font-medium mb-2`}>{label}</Text>
      <TouchableOpacity
        onPress={() => setIsOpen(true)}
        className={`${bgColor} rounded-xl border-2 ${borderColor} flex-row items-center justify-between px-4 py-3.5`}
        activeOpacity={0.7}
      >
        <Text
          className={`text-base ${
            selectedOption ? textColor : `text-[${mutedColor}]`
          }`}
          style={!selectedOption ? { color: mutedColor } : undefined}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </Text>
        <ChevronDown size={20} color={mutedColor} />
      </TouchableOpacity>
      {error && (
        <Text className="text-red-500 text-xs mt-1.5 ml-1">{error}</Text>
      )}

      <Modal visible={isOpen} transparent animationType="slide">
        <View className="flex-1 justify-end">
          <TouchableOpacity
            className="flex-1 bg-black/50"
            activeOpacity={1}
            onPress={() => {
              setIsOpen(false);
              setSearch("");
            }}
          />
          <View className={`${modalBg} rounded-t-3xl max-h-[70%] pb-8`}>
            <View className="items-center pt-3 pb-2">
              <View className="w-10 h-1 rounded-full bg-[#71717A]" />
            </View>
            <Text
              className={`${textColor} text-lg font-bold px-5 pb-3`}
            >
              {label}
            </Text>

            {searchable && (
              <View
                className={`${bgColor} mx-5 mb-3 rounded-xl flex-row items-center px-3`}
              >
                <Search size={18} color={mutedColor} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search..."
                  placeholderTextColor={mutedColor}
                  className={`${textColor} flex-1 px-3 py-3 text-base`}
                />
              </View>
            )}

            <FlatList
              data={filteredOptions}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    onSelect(item.value);
                    setIsOpen(false);
                    setSearch("");
                  }}
                  className={`flex-row items-center justify-between mx-5 mb-2 px-4 py-3.5 rounded-xl ${
                    item.value === value ? "bg-[#6C63FF]/10" : itemBg
                  }`}
                  activeOpacity={0.7}
                >
                  <Text
                    className={`text-base ${
                      item.value === value
                        ? "text-[#6C63FF] font-semibold"
                        : textColor
                    }`}
                  >
                    {item.label}
                  </Text>
                  {item.value === value && (
                    <Check size={20} color="#6C63FF" />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
