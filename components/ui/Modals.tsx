import React from "react";
import { View, Text, TouchableOpacity, Modal, TouchableWithoutFeedback } from "react-native";
import { useThemeStore } from "@/stores/themeStore";
import { Colors } from "@/constants/Colors";
import { Trash2, AlertTriangle, X } from "lucide-react-native";
import { Button } from "./Button";

export interface PostOptionsModalProps {
  visible: boolean;
  onClose: () => void;
  isOwnerOrAdmin: boolean;
  onDeleteRequest: () => void;
  onReportRequest: () => void;
}

export function PostOptionsModal({
  visible,
  onClose,
  isOwnerOrAdmin,
  onDeleteRequest,
  onReportRequest,
}: PostOptionsModalProps) {
  const { theme } = useThemeStore();
  const colors = theme === "dark" ? Colors.dark : Colors.light;
  const isDark = theme === "dark";

  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableWithoutFeedback onPress={onClose}>
        <View className="flex-1 bg-black/50 justify-end">
          <TouchableWithoutFeedback>
            <View 
              className={`rounded-t-3xl pt-2 pb-8 px-5 ${isDark ? "bg-[#1C1C1E]" : "bg-white"}`}
              style={{ shadowColor: "#000", shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, elevation: 10 }}
            >
              {/* Handle */}
              <View className="items-center mb-6">
                <View className="w-12 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600" />
              </View>

              <Text className="text-xl font-bold mb-4" style={{ color: colors.text }}>
                Post Options
              </Text>

              {isOwnerOrAdmin && (
                <TouchableOpacity 
                  onPress={() => {
                    onClose();
                    onDeleteRequest();
                  }}
                  className="flex-row items-center p-4 rounded-xl mb-3 bg-red-500/10"
                >
                  <Trash2 size={22} color="#EF4444" />
                  <Text className="ml-3 font-semibold text-lg text-red-500">Delete Post</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity 
                onPress={() => {
                  onClose();
                  onReportRequest();
                }}
                className={`flex-row items-center p-4 rounded-xl mb-4 ${isDark ? "bg-[#2C2C2E]" : "bg-gray-100"}`}
              >
                <AlertTriangle size={22} color={colors.textSecondary} />
                <Text className="ml-3 font-semibold text-lg" style={{ color: colors.text }}>Report Post</Text>
              </TouchableOpacity>
              
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

export interface ConfirmModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText: string;
  isDestructive?: boolean;
}

export function ConfirmModal({
  visible,
  onClose,
  onConfirm,
  title,
  description,
  confirmText,
  isDestructive = false,
}: ConfirmModalProps) {
  const { theme } = useThemeStore();
  const colors = theme === "dark" ? Colors.dark : Colors.light;
  const isDark = theme === "dark";

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 bg-black/60 items-center justify-center p-5">
        <View className={`w-full p-6 rounded-3xl ${isDark ? "bg-[#1C1C1E]" : "bg-white"}`}>
          <Text className="text-2xl font-bold mb-2" style={{ color: colors.text }}>{title}</Text>
          <Text className="text-base mb-6 leading-6" style={{ color: colors.textSecondary }}>{description}</Text>
          
          <View className="flex-row items-center gap-3">
            <View className="flex-1">
              <Button 
                title="Cancel" 
                variant="secondary" 
                onPress={onClose} 
              />
            </View>
            <View className="flex-1">
              <Button 
                title={confirmText} 
                variant="primary" 
                onPress={() => {
                  onClose();
                  onConfirm();
                }}
                className={isDestructive ? "bg-red-500" : ""}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
