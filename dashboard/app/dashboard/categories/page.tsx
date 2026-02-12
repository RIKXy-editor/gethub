"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { apiClient, type Category } from "@/lib/api";
import { useGuildStore } from "@/lib/store";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, FolderKanban, Save } from "lucide-react";

const DEFAULT_CATEGORY: Category = {
  id: "",
  name: "",
  emoji: "🎫",
  description: "",
  supportRoles: [],
  maxTickets: 1,
  autoCloseHours: 0,
  active: true,
};

export default function CategoriesPage() {
  const { selectedGuildId } = useGuildStore();
  const queryClient = useQueryClient();
  const [categories, setCategories] = useState<Category[]>([]);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: savedCategories, isLoading } = useQuery({
    queryKey: ["categories", selectedGuildId],
    queryFn: () => apiClient.getCategories(selectedGuildId),
    enabled: !!selectedGuildId,
  });

  const { data: roles } = useQuery({
    queryKey: ["roles", selectedGuildId],
    queryFn: () => apiClient.getRoles(selectedGuildId),
    enabled: !!selectedGuildId,
  });

  useEffect(() => {
    if (savedCategories) {
      setCategories(savedCategories);
    }
  }, [savedCategories]);

  const saveMutation = useMutation({
    mutationFn: () => apiClient.updateCategories(selectedGuildId, categories),
    onSuccess: () => {
      toast({ title: "Success", description: "Categories saved!" });
      queryClient.invalidateQueries({ queryKey: ["categories", selectedGuildId] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save categories", variant: "destructive" });
    },
  });

  const addCategory = () => {
    setEditingCategory({ ...DEFAULT_CATEGORY, id: `cat_${Date.now()}` });
    setDialogOpen(true);
  };

  const editCategory = (category: Category) => {
    setEditingCategory({ ...category });
    setDialogOpen(true);
  };

  const saveCategory = () => {
    if (!editingCategory) return;

    const existingIndex = categories.findIndex((c) => c.id === editingCategory.id);
    if (existingIndex >= 0) {
      const newCategories = [...categories];
      newCategories[existingIndex] = editingCategory;
      setCategories(newCategories);
    } else {
      setCategories([...categories, editingCategory]);
    }
    setDialogOpen(false);
    setEditingCategory(null);
  };

  const deleteCategory = (id: string) => {
    setCategories(categories.filter((c) => c.id !== id));
  };

  const toggleCategory = (id: string) => {
    setCategories(
      categories.map((c) => (c.id === id ? { ...c, active: !c.active } : c))
    );
  };

  if (!selectedGuildId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Please select a server</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Categories & Roles</h2>
          <p className="text-muted-foreground">Manage ticket categories and their support roles</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={addCategory}>
            <Plus className="mr-2 h-4 w-4" />
            Add Category
          </Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            <Save className="mr-2 h-4 w-4" />
            Save Changes
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <Card key={category.id} className={!category.active ? "opacity-60" : ""}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <span className="text-2xl">{category.emoji}</span>
                  {category.name}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={category.active}
                    onCheckedChange={() => toggleCategory(category.id)}
                  />
                </div>
              </div>
              <CardDescription>{category.description || "No description"}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-1">
                {category.supportRoles.length > 0 ? (
                  category.supportRoles.map((roleId) => {
                    const role = roles?.find((r) => r.id === roleId);
                    return (
                      <Badge key={roleId} variant="secondary">
                        {role?.name || roleId}
                      </Badge>
                    );
                  })
                ) : (
                  <span className="text-sm text-muted-foreground">No roles assigned</span>
                )}
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Max tickets: {category.maxTickets || "Default"}</span>
                <span>
                  Auto-close: {category.autoCloseHours ? `${category.autoCloseHours}h` : "Off"}
                </span>
              </div>
              <div className="flex gap-2 pt-2">
                <Button size="sm" variant="outline" onClick={() => editCategory(category)}>
                  <Pencil className="mr-2 h-3 w-3" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive"
                  onClick={() => deleteCategory(category.id)}
                >
                  <Trash2 className="mr-2 h-3 w-3" />
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {categories.length === 0 && (
          <Card className="md:col-span-2 lg:col-span-3">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FolderKanban className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No categories configured</p>
              <Button className="mt-4" onClick={addCategory}>
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Category
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory?.id?.startsWith("cat_") ? "Add Category" : "Edit Category"}
            </DialogTitle>
            <DialogDescription>Configure the ticket category settings</DialogDescription>
          </DialogHeader>

          {editingCategory && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Emoji</Label>
                  <Input
                    value={editingCategory.emoji}
                    onChange={(e) =>
                      setEditingCategory({ ...editingCategory, emoji: e.target.value })
                    }
                    placeholder="🎫"
                    className="text-center text-xl"
                  />
                </div>
                <div className="col-span-3 space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={editingCategory.name}
                    onChange={(e) =>
                      setEditingCategory({ ...editingCategory, name: e.target.value })
                    }
                    placeholder="General Support"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={editingCategory.description}
                  onChange={(e) =>
                    setEditingCategory({ ...editingCategory, description: e.target.value })
                  }
                  placeholder="Get help with general questions"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Max Tickets per User</Label>
                  <Input
                    type="number"
                    value={editingCategory.maxTickets || ""}
                    onChange={(e) =>
                      setEditingCategory({
                        ...editingCategory,
                        maxTickets: parseInt(e.target.value) || undefined,
                      })
                    }
                    placeholder="1"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Auto-close (hours)</Label>
                  <Input
                    type="number"
                    value={editingCategory.autoCloseHours || ""}
                    onChange={(e) =>
                      setEditingCategory({
                        ...editingCategory,
                        autoCloseHours: parseInt(e.target.value) || undefined,
                      })
                    }
                    placeholder="0 (disabled)"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={editingCategory.active}
                  onCheckedChange={(checked) =>
                    setEditingCategory({ ...editingCategory, active: checked })
                  }
                />
                <Label>Category Active</Label>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveCategory}>Save Category</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
