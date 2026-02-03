"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Loader2,
  User,
  Building2,
  Phone,
  Tag,
  FileText,
} from "lucide-react";

const COMMON_DEPARTMENTS = [
  "Engineering",
  "Design",
  "Marketing",
  "Sales",
  "Customer Support",
  "Human Resources",
  "Finance",
  "Operations",
  "Legal",
  "Management",
];

const COMMON_TAGS = [
  "Team Lead",
  "Senior",
  "Junior",
  "Contractor",
  "Full-time",
  "Part-time",
  "Remote",
  "On-site",
  "VIP",
  "Client",
];

interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  department: string | null;
  jobTitle: string | null;
  company: string | null;
  tags: string[];
  notes: string | null;
  isActive: boolean;
}

export default function EditContactPage() {
  const params = useParams();
  const router = useRouter();
  const contactId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contact, setContact] = useState<Contact | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    department: "",
    jobTitle: "",
    company: "",
    tags: [] as string[],
    notes: "",
  });

  const [customTag, setCustomTag] = useState("");

  const fetchContact = async () => {
    try {
      const response = await fetch(`/api/contacts/${contactId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch contact");
      }
      const data = await response.json();
      const c = data.contact;
      setContact(c);
      setFormData({
        name: c.name,
        email: c.email,
        phone: c.phone || "",
        department: c.department || "",
        jobTitle: c.jobTitle || "",
        company: c.company || "",
        tags: (c.tags as string[]) || [],
        notes: c.notes || "",
      });
    } catch (err) {
      console.error("Error fetching contact:", err);
      router.push("/dashboard/contacts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContact();
  }, [contactId]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddTag = (tag: string) => {
    if (tag && !formData.tags.includes(tag)) {
      setFormData((prev) => ({ ...prev, tags: [...prev.tags, tag] }));
    }
    setCustomTag("");
  };

  const handleRemoveTag = (tag: string) => {
    setFormData((prev) => ({ ...prev, tags: prev.tags.filter((t) => t !== tag) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update contact");
      }

      router.push("/dashboard/contacts");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-white/40 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="border-b border-white/10 bg-black">
        <div className="container mx-auto px-8 py-8">
          <Link href="/dashboard/contacts">
            <Button
              variant="ghost"
              className="text-white/60 hover:text-white mb-4 rounded-full"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Contacts
            </Button>
          </Link>

          <h1 className="text-3xl font-bold text-white">Edit Contact</h1>
          <p className="text-white/50 mt-1">
            Update contact information for {contact?.name}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-8 py-8">
        <div className="max-w-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error Message */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* Basic Info Section */}
            <div className="bg-white/[0.02] border border-white/10 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <User className="h-5 w-5" />
                Basic Information
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">
                    Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-white/[0.02] border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-white/20"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">
                    Email <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-white/[0.02] border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-white/20"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">
                    Phone
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="+1 234 567 8900"
                    className="w-full px-4 py-3 bg-white/[0.02] border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-white/20"
                  />
                </div>
              </div>
            </div>

            {/* Organization Section */}
            <div className="bg-white/[0.02] border border-white/10 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Organization Details
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">
                    Department
                  </label>
                  <select
                    name="department"
                    value={formData.department}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-white/[0.02] border border-white/10 rounded-lg text-white focus:outline-none focus:border-white/20"
                  >
                    <option value="">Select department...</option>
                    {COMMON_DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">
                    Job Title
                  </label>
                  <input
                    type="text"
                    name="jobTitle"
                    value={formData.jobTitle}
                    onChange={handleChange}
                    placeholder="Software Engineer"
                    className="w-full px-4 py-3 bg-white/[0.02] border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-white/20"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">
                    Company
                  </label>
                  <input
                    type="text"
                    name="company"
                    value={formData.company}
                    onChange={handleChange}
                    placeholder="Acme Inc."
                    className="w-full px-4 py-3 bg-white/[0.02] border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-white/20"
                  />
                </div>
              </div>
            </div>

            {/* Tags Section */}
            <div className="bg-white/[0.02] border border-white/10 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Tag className="h-5 w-5" />
                Tags
              </h2>

              <div className="space-y-4">
                {/* Quick Add Tags */}
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">
                    Quick Add
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {COMMON_TAGS.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleAddTag(tag)}
                        className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                          formData.tags.includes(tag)
                            ? "bg-purple-500/20 border-purple-500/50 text-purple-300"
                            : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Tag Input */}
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">
                    Custom Tag
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customTag}
                      onChange={(e) => setCustomTag(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddTag(customTag);
                        }
                      }}
                      placeholder="Enter custom tag..."
                      className="flex-1 px-4 py-3 bg-white/[0.02] border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-white/20"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="border-white/20 text-white"
                      onClick={() => handleAddTag(customTag)}
                    >
                      Add
                    </Button>
                  </div>
                </div>

                {/* Selected Tags */}
                {formData.tags.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Selected Tags
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {formData.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-purple-500/20 border border-purple-500/50 text-purple-300 rounded-full"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(tag)}
                            className="hover:text-white"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Notes Section */}
            <div className="bg-white/[0.02] border border-white/10 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Notes
              </h2>

              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Add any additional notes about this contact..."
                rows={4}
                className="w-full px-4 py-3 bg-white/[0.02] border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-white/20 resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-4">
              <Link href="/dashboard/contacts">
                <Button
                  type="button"
                  variant="outline"
                  className="border-white/20 text-white hover:bg-white/5"
                  disabled={saving}
                >
                  Cancel
                </Button>
              </Link>
              <Button
                type="submit"
                className="btn-gradient text-black px-8"
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
