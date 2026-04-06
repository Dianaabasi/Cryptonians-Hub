import { Colors } from "@/constants/Colors";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import { useThemeStore } from "@/stores/themeStore";
import { useRouter } from "expo-router";
import {
  Bookmark,
  BookOpen,
  CheckCircle,
  FileText,
  Filter,
  Link as LinkIcon,
  Plus,
  Search,
  ThumbsUp,
  Trash2,
  X,
  XCircle
} from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AlertModal, ConfirmModal } from "@/components/ui/Modals";

interface Material {
  id: string;
  title: string;
  description: string;
  material_type: string;
  category: string;
  difficulty: string;
  status: string;
  upvotes: number;
  created_at: string;
  author: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
  custom_author?: string | null;
  material_url: string;
  hasUpvoted?: boolean;
  hasSaved?: boolean;
}

const DEFAULT_CATEGORIES = ["All", "DeFi", "Trading", "Marketing", "Dev"];

const ogCache = new Map<string, string | null>();

const OGImagePreview = ({ url, isDark }: { url: string, isDark: boolean }) => {
  const [imgUrl, setImgUrl] = useState<string | null>(ogCache.get(url) || null);
  
  useEffect(() => {
    const cached = ogCache.get(url);
    if (cached !== undefined) {
      setImgUrl(cached);
      return;
    }
    
    if (ogCache.has(url)) return;
    
    fetch(url, { headers: { 'User-Agent': 'Bot' }})
      .then(r => r.text())
      .then(html => {
        const match = html.match(/<meta\s+(?:property|name)=["']og:image["']\s+content=["'](.*?)["']/i);
        if (match && match[1]) {
          ogCache.set(url, match[1]);
          setImgUrl(match[1]);
        } else {
          ogCache.set(url, null);
        }
      })
      .catch(() => {
        ogCache.set(url, null);
      });
  }, [url]);

  if (!imgUrl) {
    // Fallback: styled banner with link icon
    return (
      <View className={`w-full h-32 rounded-2xl items-center justify-center mb-3 ${isDark ? "bg-[#2C2C2E]" : "bg-gray-100"}`}>
        <LinkIcon size={32} color="#6C63FF" />
        <Text className="text-xs mt-2 font-semibold" style={{ color: isDark ? "#888" : "#999" }}>Link Preview</Text>
      </View>
    );
  }

  return (
    <Image 
      source={{ uri: imgUrl }} 
      className="w-full h-40 rounded-2xl mb-3"
      style={{ backgroundColor: isDark ? "#2C2C2E" : "#F3F4F6" }} 
      resizeMode="cover" 
    />
  );
};

export default function EducationScreen() {
  const router = useRouter();
  const { theme } = useThemeStore();
  const { profile } = useAuthStore();
  const colors = theme === "dark" ? Colors.dark : Colors.light;
  const isDark = theme === "dark";

  const isAdmin = profile?.role === "admin" || profile?.role === "mod";
  const tabs = isAdmin
    ? ["Discover", "Popular", "My Library", "Review Queue"]
    : ["Discover", "Popular", "My Library"];

  const [activeTab, setActiveTab] = useState("Discover");
  const [activeCategory, setActiveCategory] = useState("All");
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Skeleton Animation Value
  const fadeAnim = React.useRef(new Animated.Value(0.5)).current;

  // Dynamic Categories from DB + Defaults
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterDifficulty, setFilterDifficulty] = useState("All");
  const [filterType, setFilterType] = useState("All"); // All, PDF, DOCX, Link

  // Pending queue highlight (admin only)
  const [pendingReviewCount, setPendingReviewCount] = useState(0);

  // Material deletion (admin only)
  const [materialToOptions, setMaterialToOptions] = useState<Material | null>(null);
  const [materialToDelete, setMaterialToDelete] = useState<Material | null>(null);
  const [isDeletingMaterial, setIsDeletingMaterial] = useState(false);

  // Success / Error Alerts
  const [alertConfig, setAlertConfig] = useState<{ visible: boolean; title: string; description: string; type: "success" | "error" | "info" }>({
    visible: false,
    title: "",
    description: "",
    type: "info"
  });

  const fetchMaterials = async () => {
    if (!profile?.id) return;
    try {
      let query = supabase.from("education_materials").select(`
          *,
          author:profiles!education_materials_author_id_fkey(id, full_name, avatar_url)
        `);

      if (activeTab === "Discover") {
        query = query
          .eq("status", "approved")
          .order("created_at", { ascending: false });
      } else if (activeTab === "Popular") {
        query = query
          .eq("status", "approved")
          .gt("upvotes", 0)
          .order("upvotes", { ascending: false });
      } else if (activeTab === "Review Queue" && isAdmin) {
        query = query
          .eq("status", "pending")
          .order("created_at", { ascending: true });
      } else if (activeTab === "My Library") {
        // Only approved materials can be saved/bookmarked
        query = query
          .eq("status", "approved")
          .order("created_at", { ascending: false });
      }

      if (activeCategory !== "All") {
        query = query.eq("category", activeCategory);
      }

      if (searchQuery.trim().length > 0) {
        query = query.ilike("title", `%${searchQuery.trim()}%`);
      }

      if (filterDifficulty !== "All") {
        query = query.eq("difficulty", filterDifficulty.toLowerCase());
      }

      if (filterType !== "All") {
        query = query.eq("material_type", filterType.toLowerCase());
      }

      const { data: dbMaterials, error } = await query;
      if (error) throw error;

      let fetchedMaterials = dbMaterials as Material[];

      // Enhance with Upvotes & Saves
      const { data: myUpvotes } = await supabase
        .from("education_upvotes")
        .select("material_id")
        .eq("user_id", profile.id);

      const { data: mySaves } = await supabase
        .from("education_saves")
        .select("material_id")
        .eq("user_id", profile.id);

      const upvotedIds = new Set(myUpvotes?.map((u) => u.material_id));
      const savedIds = new Set(mySaves?.map((s) => s.material_id));

      fetchedMaterials = fetchedMaterials.map((m) => ({
        ...m,
        hasUpvoted: upvotedIds.has(m.id),
        hasSaved: savedIds.has(m.id),
      }));

      // Filter local if "My Library" since we can't easily join in REST for all statuses reliably
      if (activeTab === "My Library") {
        fetchedMaterials = fetchedMaterials.filter((m) => m.hasSaved);
      }

      setMaterials(fetchedMaterials);

      // Extract unique categories globally
      const { data: allMats } = await supabase
        .from("education_materials")
        .select("category")
        .eq("status", "approved");
      if (allMats) {
        const uniqueCats = new Set([
          ...DEFAULT_CATEGORIES,
          ...allMats.map((m) => m.category),
        ]);
        setCategories(Array.from(uniqueCats));
      }

      // Check review queue count for admins
      if (isAdmin) {
        const { count } = await supabase
          .from("education_materials")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending");
        setPendingReviewCount(count || 0);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0.5,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    ).start();

    fetchMaterials();
  }, [profile?.id, activeTab, activeCategory, filterDifficulty, filterType]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchMaterials();
  }, [activeTab, activeCategory, filterDifficulty, filterType, searchQuery]);

  const toggleUpvote = async (mat: Material) => {
    if (!profile?.id) return;
    const isUpvoted = mat.hasUpvoted;

    // Optimistic UI
    setMaterials((prev) =>
      prev.map((m) =>
        m.id === mat.id
          ? {
              ...m,
              hasUpvoted: !isUpvoted,
              upvotes: isUpvoted ? m.upvotes - 1 : m.upvotes + 1,
            }
          : m,
      ),
    );

    try {
      if (isUpvoted) {
        await supabase
          .from("education_upvotes")
          .delete()
          .match({ user_id: profile.id, material_id: mat.id });
      } else {
        await supabase
          .from("education_upvotes")
          .insert({ user_id: profile.id, material_id: mat.id });
      }
    } catch {
      // Revert if error
      fetchMaterials();
    }
  };

  const toggleSave = async (mat: Material) => {
    if (!profile?.id) return;
    const isSaved = mat.hasSaved;

    setMaterials((prev) =>
      prev.map((m) => (m.id === mat.id ? { ...m, hasSaved: !isSaved } : m)),
    );

    try {
      if (isSaved) {
        await supabase
          .from("education_saves")
          .delete()
          .match({ user_id: profile.id, material_id: mat.id });
      } else {
        await supabase
          .from("education_saves")
          .insert({ user_id: profile.id, material_id: mat.id });
      }
    } catch {
      fetchMaterials();
    }
  };

  const handleDeleteMaterial = (material: Material) => {
    if (!isAdmin) return;
    setMaterialToOptions(material);
  };

  const confirmDeleteMaterial = async () => {
    if (!materialToDelete) return;
    setIsDeletingMaterial(true);
    try {
      const { error } = await supabase
        .from("education_materials")
        .delete()
        .eq("id", materialToDelete.id);
      if (error) throw error;
      setMaterials((prev) => prev.filter((m) => m.id !== materialToDelete.id));
      setMaterialToDelete(null);
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Could not delete material.");
    } finally {
      setIsDeletingMaterial(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await supabase
        .from("education_materials")
        .update({ status: "approved" })
        .eq("id", id);
      setMaterials((prev) => prev.filter((m) => m.id !== id));
      setAlertConfig({
        visible: true,
        title: "Approved",
        description: "Material is now live.",
        type: "success"
      });
    } catch (e) {
      console.error(e);
      setAlertConfig({
        visible: true,
        title: "Error",
        description: "Could not approve.",
        type: "error"
      });
    }
  };

  const handleReject = async (id: string, name: string) => {
    Alert.alert(
      "Reject Material",
      `Are you sure you want to permanently delete "${name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              // Delete from DB. Storage trigger or scheduled cron can cleanup abandoned files,
              // or handle storage deletion right here if we grabbed the URL.
              await supabase.from("education_materials").delete().eq("id", id);
              setMaterials((prev) => prev.filter((m) => m.id !== id));
              setAlertConfig({
                visible: true,
                title: "Rejected",
                description: "Material permanently deleted.",
                type: "success"
              });
            } catch (e) {
              console.error(e);
            }
          },
        },
      ],
    );
  };

  const renderMaterial = ({ item }: { item: Material }) => {
    return (
      <TouchableOpacity
        onPress={() => router.push(`/education/viewer/${item.id}` as any)}
        onLongPress={() => isAdmin && handleDeleteMaterial(item)}
        delayLongPress={500}
        activeOpacity={0.8}
        className={`mb-4 rounded-3xl overflow-hidden p-4 ${
          isDark
            ? "bg-[#1C1C1E] border border-[#2C2C2E]"
            : "bg-white border border-gray-100"
        }`}
      >
        {/* Link materials: full-width banner preview ABOVE the content row */}
          {item.material_type === "link" && (
            <OGImagePreview url={item.material_url} isDark={isDark} />
          )}

        <View className="flex-row">
          {/* PDF / DOCX square badge */}
          {item.material_type === "pdf" ? (
            <View className={`w-14 h-14 rounded-2xl items-center justify-center mr-4 ${isDark ? "bg-red-500/10 border border-red-500/20" : "bg-red-50 border border-red-100"}`}>
              <FileText size={24} color="#EF4444" />
              <Text className="text-[9px] font-bold text-[#EF4444] mt-0.5">PDF</Text>
            </View>
          ) : item.material_type === "docx" ? (
            <View className={`w-14 h-14 rounded-2xl items-center justify-center mr-4 ${isDark ? "bg-blue-500/10 border border-blue-500/20" : "bg-blue-50 border border-blue-100"}`}>
              <FileText size={24} color="#3B82F6" />
              <Text className="text-[9px] font-bold text-[#3B82F6] mt-0.5">DOCX</Text>
            </View>
          ) : (
            // Link type — no left icon, thumbnail is above
            <View className="w-8 h-8 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: isDark ? "#2C2C2E" : "#F3F4F6" }}>
              <LinkIcon size={16} color="#6C63FF" />
            </View>
          )}

          {/* Content */}
          <View className="flex-1">
            <Text
              className="text-base font-bold mb-1"
              style={{ color: colors.text }}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            <Text
              className="text-xs mb-2"
              style={{ color: colors.textSecondary }}
              numberOfLines={2}
            >
              {item.description}
            </Text>

            <View className="flex-row items-center gap-2">
              <View className="bg-[#6C63FF]/10 px-2 py-1 rounded-md">
                <Text className="text-[10px] uppercase font-bold text-[#6C63FF]">
                  {item.category}
                </Text>
              </View>
              {item.difficulty && (
                <View className="bg-amber-500/10 px-2 py-1 rounded-md">
                  <Text className="text-[10px] uppercase font-bold text-amber-500">
                    {item.difficulty}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Action Bar */}
        <View
          className={`border-t flex-row items-center justify-between pt-3 mt-3 ${isDark ? "border-[#2C2C2E]" : "border-gray-100"}`}
        >
          <View className="flex-1 mr-2">
            {item.custom_author ? (
              <Text className="text-[10px] font-bold" style={{ color: colors.textSecondary }}>
                Author: {item.custom_author}
              </Text>
            ) : null}
            <Text className="text-[9px]" style={{ color: colors.textSecondary }}>
              Uploaded by: {item.author?.full_name || "Unknown"}
            </Text>
            <Text className="text-[9px] mt-0.5" style={{ color: colors.textSecondary, opacity: 0.8 }}>
              {new Date(item.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
            </Text>
          </View>

          {activeTab === "Review Queue" ? (
            <View className="flex-row gap-4">
              <TouchableOpacity
                onPress={() => handleReject(item.id, item.title)}
              >
                <XCircle size={20} color="#EF4444" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleApprove(item.id)}>
                <CheckCircle size={20} color="#10B981" />
              </TouchableOpacity>
            </View>
          ) : (
            <View className="flex-row gap-5">
              <TouchableOpacity
                className="flex-row items-center gap-1"
                onPress={() => toggleUpvote(item)}
              >
                <ThumbsUp
                  size={16}
                  color={item.hasUpvoted ? "#6C63FF" : colors.textSecondary}
                />
                <Text
                  style={{
                    color: item.hasUpvoted ? "#6C63FF" : colors.textSecondary,
                    fontSize: 12,
                  }}
                >
                  {item.upvotes}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => toggleSave(item)}>
                <Bookmark
                  size={16}
                  color={item.hasSaved ? "#F59E0B" : colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView
      className="flex-1"
      style={{ backgroundColor: colors.background }}
    >
      {/* Header */}
      <View className="px-5 pt-4 pb-2 z-10 flex-row justify-between items-center h-16">
        {!isSearchExpanded ? (
          <>
            <Text
              className="text-2xl font-bold mr-4"
              style={{ color: colors.text }}
            >
              Education Hub
            </Text>
            <View className="flex-row items-center gap-2">
              <TouchableOpacity
                onPress={() => setIsSearchExpanded(true)}
                className={`w-10 h-10 items-center justify-center rounded-xl ${filterDifficulty !== "All" || filterType !== "All" || searchQuery.length > 0 ? "bg-[#6C63FF]/20" : isDark ? "bg-[#1C1C1E]" : "bg-gray-100"}`}
              >
                <Search
                  size={18}
                  color={
                    filterDifficulty !== "All" ||
                    filterType !== "All" ||
                    searchQuery.length > 0
                      ? "#6C63FF"
                      : colors.text
                  }
                />
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View className="flex-1 flex-row items-center gap-2">
            <View
              className="flex-1 flex-row items-center px-3 py-2 rounded-xl"
              style={{ backgroundColor: isDark ? "#1C1C1E" : "#F3F4F6" }}
            >
              <Search size={16} color={colors.textSecondary} />
              <TextInput
                autoFocus
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={fetchMaterials}
                placeholder="Search..."
                placeholderTextColor={colors.textSecondary}
                className="flex-1 ml-2 text-sm"
                style={{ color: colors.text, padding: 0 }}
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setSearchQuery("");
                    fetchMaterials();
                  }}
                  className="mr-3"
                >
                  <X size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => setFilterOpen(true)}
                className="pl-2 border-l"
                style={{ borderColor: isDark ? "#2C2C2E" : "#E5E7EB" }}
              >
                <Filter
                  size={16}
                  color={
                    filterDifficulty !== "All" || filterType !== "All"
                      ? "#6C63FF"
                      : colors.textSecondary
                  }
                />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              onPress={() => {
                setIsSearchExpanded(false);
                setSearchQuery("");
                fetchMaterials();
              }}
              className="px-2"
            >
              <Text
                className="text-sm font-bold"
                style={{ color: colors.textSecondary }}
              >
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Filter Modal */}
      <Modal visible={filterOpen} animationType="slide" transparent>
        <View className="flex-1 justify-end bg-black/50">
          <View
            className="rounded-t-3xl p-6"
            style={{ backgroundColor: colors.background }}
          >
            <View className="flex-row justify-between items-center mb-6">
              <Text
                className="text-lg font-bold"
                style={{ color: colors.text }}
              >
                Filters
              </Text>
              <TouchableOpacity
                onPress={() => setFilterOpen(false)}
                className="p-2 -mr-2"
              >
                <Text
                  style={{ color: colors.textSecondary }}
                  className="font-bold"
                >
                  Done
                </Text>
              </TouchableOpacity>
            </View>

            <Text
              className="text-sm font-semibold mb-3"
              style={{ color: colors.textSecondary }}
            >
              Difficulty
            </Text>
            <View className="flex-row gap-2 mb-6">
              {["All", "Beginner", "Intermediate", "Advanced"].map((level) => (
                <TouchableOpacity
                  key={level}
                  onPress={() => setFilterDifficulty(level)}
                  className={`px-4 py-2 rounded-xl border ${filterDifficulty === level ? "bg-amber-500/10 border-amber-500/30" : isDark ? "bg-[#1C1C1E] border-[#2C2C2E]" : "bg-white border-gray-200"}`}
                >
                  <Text
                    className="text-xs font-bold"
                    style={{
                      color:
                        filterDifficulty === level
                          ? "#F59E0B"
                          : colors.textSecondary,
                    }}
                  >
                    {level}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text
              className="text-sm font-semibold mb-3"
              style={{ color: colors.textSecondary }}
            >
              Material Type
            </Text>
            <View className="flex-row gap-2 mb-8">
              {["All", "PDF", "DOCX", "Link"].map((type) => (
                <TouchableOpacity
                  key={type}
                  onPress={() => setFilterType(type)}
                  className={`px-4 py-2 rounded-xl border ${filterType === type ? "bg-[#6C63FF]/10 border-[#6C63FF]/30" : isDark ? "bg-[#1C1C1E] border-[#2C2C2E]" : "bg-white border-gray-200"}`}
                >
                  <Text
                    className="text-xs font-bold"
                    style={{
                      color:
                        filterType === type ? "#6C63FF" : colors.textSecondary,
                    }}
                  >
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              onPress={() => {
                setFilterDifficulty("All");
                setFilterType("All");
                setSearchQuery("");
                fetchMaterials();
              }}
              className="py-4 items-center mb-4 border border-red-500/30 rounded-xl bg-red-500/10"
            >
              <Text className="text-red-500 font-bold">Reset Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Material Options Bottom Sheet (admin long press) */}
      <Modal visible={!!materialToOptions} animationType="slide" transparent>
        <View className="flex-1 justify-end bg-black/50">
          <TouchableOpacity className="flex-1" activeOpacity={1} onPress={() => setMaterialToOptions(null)} />
          <View className="rounded-t-3xl p-6" style={{ backgroundColor: isDark ? "#1C1C1E" : "#FFF", paddingBottom: Platform.OS === "ios" ? 40 : 24 }}>
            <View className="w-10 h-1 rounded-full bg-gray-400/40 self-center mb-6" />
            <Text className="text-base font-bold mb-1" style={{ color: colors.text }} numberOfLines={1}>
              {materialToOptions?.title}
            </Text>
            <Text className="text-xs mb-4" style={{ color: colors.textSecondary }}>Admin — Material Options</Text>
            <TouchableOpacity
              onPress={() => {
                setMaterialToDelete(materialToOptions);
                setMaterialToOptions(null);
              }}
              className="flex-row items-center gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 mb-3"
            >
              <Trash2 size={20} color="#EF4444" />
              <Text className="font-bold text-red-500">Delete Material</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setMaterialToOptions(null)}
              className={`p-4 rounded-2xl border ${isDark ? "border-[#2C2C2E]" : "border-gray-200"}`}
            >
              <Text className="font-bold text-center" style={{ color: colors.textSecondary }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Material Delete Confirmation Modal */}
      <Modal visible={!!materialToDelete} animationType="fade" transparent>
        <View className="flex-1 justify-center items-center px-6 bg-black/60">
          <View className="w-full rounded-3xl p-6" style={{ backgroundColor: isDark ? "#1C1C1E" : "#FFF" }}>
            <View className="w-12 h-12 rounded-full bg-red-500/10 items-center justify-center mb-4 self-center">
              <Trash2 size={24} color="#EF4444" />
            </View>
            <Text className="text-xl font-bold text-center mb-2" style={{ color: colors.text }}>Delete Material?</Text>
            <Text className="text-sm text-center mb-6" style={{ color: colors.textSecondary }}>
              Are you sure you want to permanently delete{" "}
              <Text className="font-bold" style={{ color: colors.text }}>"{materialToDelete?.title}"</Text>?
              {"\n"}This action cannot be undone.
            </Text>
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setMaterialToDelete(null)}
                disabled={isDeletingMaterial}
                className={`flex-1 py-3.5 rounded-xl items-center border ${isDark ? "border-[#2C2C2E]" : "border-gray-200"}`}
              >
                <Text className="font-bold text-sm" style={{ color: colors.text }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmDeleteMaterial}
                disabled={isDeletingMaterial}
                className="flex-1 py-3.5 rounded-xl items-center bg-red-500"
              >
                {isDeletingMaterial ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text className="text-white font-bold text-sm">Yes, Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Tabs */}
      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="px-5 pb-3"
        >
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => {
                if (activeTab !== tab) {
                  setMaterials([]);
                  setLoading(true);
                  setActiveTab(tab);
                }
              }}
              className="mr-4 pb-2 flex-row items-center"
              style={{
                borderBottomWidth: activeTab === tab ? 2 : 0,
                borderBottomColor: "#6C63FF",
              }}
            >
              <Text
                className="font-bold tracking-wide"
                style={{
                  color: activeTab === tab ? "#6C63FF" : colors.textSecondary,
                  fontSize: 14,
                }}
              >
                {tab}
              </Text>
              {tab === "Review Queue" && pendingReviewCount > 0 && (
                <View className="w-1.5 h-1.5 rounded-full bg-red-500 ml-1 mb-2" />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Categories */}
      {activeTab !== "Review Queue" && activeTab !== "My Library" && (
        <View
          className="mb-2 border-b"
          style={{ borderColor: isDark ? "#2C2C2E" : "#F3F4F6" }}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="px-5 pb-3"
          >
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat}
                onPress={() => {
                  if (activeCategory !== cat) {
                    setMaterials([]);
                    setLoading(true);
                    setActiveCategory(cat);
                  }
                }}
                className={`mr-2 px-4 py-1.5 rounded-full border ${
                  activeCategory === cat
                    ? "bg-[#6C63FF] border-[#6C63FF]"
                    : isDark
                      ? "bg-[#1C1C1E] border-[#2C2C2E]"
                      : "bg-white border-gray-200"
                }`}
              >
                <Text
                  className="font-bold text-xs"
                  style={{
                    color:
                      activeCategory === cat ? "#FFF" : colors.textSecondary,
                  }}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* List */}
      {loading ? (
        <ScrollView
          className="flex-1 px-5 pt-3 mb-10"
          showsVerticalScrollIndicator={false}
        >
          {[1, 2, 3, 4].map((i) => (
            <Animated.View
              key={i}
              style={{ opacity: fadeAnim }}
              className={`mb-4 rounded-3xl p-4 border ${isDark ? "bg-[#1C1C1E] border-[#2C2C2E]" : "bg-white border-gray-100"}`}
            >
              <View className="flex-row mb-3">
                <View
                  className={`w-12 h-12 rounded-2xl mr-4 ${isDark ? "bg-[#2C2C2E]" : "bg-gray-200"}`}
                />
                <View className="flex-1 justify-center">
                  <View
                    className={`h-4 rounded w-3/4 mb-2 ${isDark ? "bg-[#2C2C2E]" : "bg-gray-200"}`}
                  />
                  <View
                    className={`h-3 rounded w-1/2 ${isDark ? "bg-[#2C2C2E]" : "bg-gray-200"}`}
                  />
                </View>
              </View>
              <View className="flex-row gap-2 mb-3">
                <View
                  className={`h-6 rounded w-16 ${isDark ? "bg-[#2C2C2E]" : "bg-gray-200"}`}
                />
                <View
                  className={`h-6 rounded w-20 ${isDark ? "bg-[#2C2C2E]" : "bg-gray-200"}`}
                />
              </View>
              <View
                className={`border-t pt-3 flex-row justify-between ${isDark ? "border-[#2C2C2E]" : "border-gray-100"}`}
              >
                <View
                  className={`h-3 rounded w-24 ${isDark ? "bg-[#2C2C2E]" : "bg-gray-200"}`}
                />
                <View
                  className={`h-3 rounded w-16 ${isDark ? "bg-[#2C2C2E]" : "bg-gray-200"}`}
                />
              </View>
            </Animated.View>
          ))}
        </ScrollView>
      ) : (
        <FlatList
          data={materials}
          keyExtractor={(item) => item.id}
          renderItem={renderMaterial}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 10,
            paddingBottom: 100,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#6C63FF"
            />
          }
          ListEmptyComponent={
            <View className="py-20 items-center justify-center">
              <BookOpen size={48} color={isDark ? "#2C2C2E" : "#E5E7EB"} />
              <Text
                className="text-lg text-center mt-4 font-semibold"
                style={{ color: colors.textSecondary }}
              >
                {activeTab === "Review Queue"
                  ? "No pending materials!"
                  : activeTab === "My Library"
                    ? "Your library is empty."
                    : "No materials found."}
              </Text>
            </View>
          }
        />
      )}

      {/* Upload FAB */}
      <TouchableOpacity
        onPress={() => router.push("/education/upload")}
        className="absolute right-5 w-14 h-14 bg-[#6C63FF] rounded-full items-center justify-center shadow-lg"
        style={{
          bottom: 100,
          shadowColor: "#6C63FF",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 5,
        }}
      >
        <Plus size={24} color="#FFF" />
      </TouchableOpacity>

      <AlertModal
        visible={alertConfig.visible}
        title={alertConfig.title}
        description={alertConfig.description}
        type={alertConfig.type}
        onClose={() => setAlertConfig((prev) => ({ ...prev, visible: false }))}
      />
    </SafeAreaView>
  );
}
