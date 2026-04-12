import React from "react";
import { Modal, View, Text, TouchableOpacity } from "react-native";
import { AlertTriangle, Info, CheckCircle, XCircle } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import { Colors } from "@/constants/Colors";

export type AppModalVariant = "error" | "success" | "warning" | "info" | "confirm";

export interface AppModalButton {
  text: string;
  onPress: () => void;
  style?: "default" | "destructive" | "cancel";
}

interface AppModalProps {
  visible: boolean;
  title: string;
  message?: string;
  variant?: AppModalVariant;
  buttons?: AppModalButton[];
  onClose?: () => void;
}

const variantConfig: Record<AppModalVariant, { icon: React.ReactNode; iconBg: string }> = {
  error: {
    icon: <XCircle size={30} color="#EF4444" />,
    iconBg: "rgba(239,68,68,0.15)",
  },
  success: {
    icon: <CheckCircle size={30} color="#10B981" />,
    iconBg: "rgba(16,185,129,0.15)",
  },
  warning: {
    icon: <AlertTriangle size={30} color="#F59E0B" />,
    iconBg: "rgba(245,158,11,0.15)",
  },
  confirm: {
    icon: <AlertTriangle size={30} color="#EF4444" />,
    iconBg: "rgba(239,68,68,0.15)",
  },
  info: {
    icon: <Info size={30} color="#6C63FF" />,
    iconBg: "rgba(108,99,255,0.15)",
  },
};

export function AppModal({
  visible,
  title,
  message,
  variant = "info",
  buttons,
  onClose,
}: AppModalProps) {
  const { theme } = useThemeStore();
  const isDark = theme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const { icon, iconBg } = variantConfig[variant];

  // Default single OK button if none provided
  const resolvedButtons: AppModalButton[] = buttons ?? [
    { text: "OK", onPress: onClose ?? (() => {}), style: "default" },
  ];

  const getButtonStyle = (style?: AppModalButton["style"]) => {
    if (style === "destructive") return "bg-red-500";
    if (style === "cancel") return isDark ? "bg-[#2C2C2E]" : "bg-gray-100";
    return "bg-[#6C63FF]";
  };

  const getButtonTextStyle = (style?: AppModalButton["style"]) => {
    if (style === "cancel") return { color: colors.text };
    return { color: "#FFF" };
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity
        activeOpacity={1}
        className="flex-1 bg-black/60 justify-center items-center px-6"
        onPress={onClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => {}} // block tap-through
          className="w-full rounded-3xl p-8 shadow-2xl items-center border"
          style={{
            backgroundColor: isDark ? "#1C1C1E" : "#FFF",
            borderColor: isDark ? "#2C2C2E" : "#F3F4F6",
          }}
        >
          {/* Icon */}
          <View
            className="w-16 h-16 rounded-full items-center justify-center mb-5"
            style={{ backgroundColor: iconBg }}
          >
            {icon}
          </View>

          <Text className="text-xl font-bold mb-2 text-center" style={{ color: colors.text }}>
            {title}
          </Text>

          {message && (
            <Text className="text-sm text-center mb-8 leading-6" style={{ color: colors.textSecondary }}>
              {message}
            </Text>
          )}

          {/* Buttons */}
          <View className={`w-full ${resolvedButtons.length > 1 ? "flex-row gap-3" : ""}`}>
            {resolvedButtons.map((btn, i) => (
              <TouchableOpacity
                key={i}
                className={`flex-1 py-3.5 rounded-2xl items-center ${getButtonStyle(btn.style)} ${resolvedButtons.length === 1 ? "mt-2" : ""}`}
                onPress={btn.onPress}
              >
                <Text className="font-semibold text-base" style={getButtonTextStyle(btn.style)}>
                  {btn.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

/**
 * Hook-based imperative API — mirrors Alert.alert() for easy migration.
 * Usage:
 *   const { showModal, modalProps } = useAppModal();
 *   showModal({ title: "Error", message: "Something went wrong", variant: "error" });
 *   // In JSX: <AppModal {...modalProps} />
 */
export interface ShowModalOptions {
  title: string;
  message?: string;
  variant?: AppModalVariant;
  buttons?: AppModalButton[];
}

export function useAppModal() {
  const [modalProps, setModalProps] = React.useState<AppModalProps>({
    visible: false,
    title: "",
  });

  const showModal = React.useCallback((opts: ShowModalOptions) => {
    setModalProps({
      visible: true,
      title: opts.title,
      message: opts.message,
      variant: opts.variant ?? "info",
      buttons: opts.buttons?.map((b) => ({
        ...b,
        onPress: () => {
          setModalProps((p) => ({ ...p, visible: false }));
          b.onPress?.();
        },
      })) ?? [
        {
          text: "OK",
          style: "default",
          onPress: () => setModalProps((p) => ({ ...p, visible: false })),
        },
      ],
      onClose: () => setModalProps((p) => ({ ...p, visible: false })),
    });
  }, []);

  return { showModal, modalProps };
}
