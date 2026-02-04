"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Plus,
  Search,
  Mail,
  Building2,
  MoreVertical,
  Edit,
  Trash2,
  Loader2,
  UserPlus,
} from "lucide-react";

interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  department: string | null;
  jobTitle: string | null;
  company: string | null;
  tags: string[];
  isActive: boolean;
  createdAt: string;
}

export default function ContactsPage() {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchContacts = async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (departmentFilter) params.append("department", departmentFilter);

      const response = await fetch(`/api/contacts?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setContacts(data.contacts || []);
      }
    } catch (error) {
      console.error("Error fetching contacts:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      const response = await fetch(`/api/contacts/${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setContacts(contacts.filter((c) => c.id !== id));
        setShowDeleteConfirm(null);
      }
    } catch (error) {
      console.error("Error deleting contact:", error);
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, [search, departmentFilter]);

  const departments = Array.from(
    new Set(contacts.map((c) => c.department).filter((d): d is string => d !== null))
  );

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="border-b border-white/10 bg-black">
        <div className="container mx-auto px-8 py-8">
          <Link href="/dashboard">
            <Button
              variant="ghost"
              className="text-white/60 hover:text-white mb-4 rounded-full"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <h1 className="text-3xl font-bold text-white">Contacts</h1>
              <p className="text-white/50 mt-1">
                Manage your team members and external contacts
              </p>
            </div>

            <Button
              size="lg"
              className="text-base btn-gradient text-black px-6 py-5 rounded-full"
              onClick={() => router.push("/dashboard/contacts/new")}
            >
              <Plus className="mr-2 h-5 w-5" />
              Add Contact
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-8 py-8">
        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white/[0.02] border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:border-white/20"
            />
          </div>

          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="px-4 py-3 bg-white/[0.02] border border-white/10 rounded-xl text-white focus:outline-none focus:border-white/20"
          >
            <option value="">All Departments</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>

        {/* Contacts List */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 text-white/40 animate-spin" />
          </div>
        ) : contacts.length === 0 ? (
          <div className="bg-white/[0.02] border border-white/10 rounded-xl p-12 text-center">
            <UserPlus className="h-16 w-16 text-white/20 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No contacts yet</h3>
            <p className="text-white/50 mb-6">
              {search || departmentFilter
                ? "No contacts match your search criteria."
                : "Get started by adding your first contact."}
            </p>
            {!search && !departmentFilter && (
              <Button
                className="btn-gradient text-black rounded-full"
                onClick={() => router.push("/dashboard/contacts/new")}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Your First Contact
              </Button>
            )}
          </div>
        ) : (
          <div className="bg-white/[0.02] border border-white/10 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/[0.02] border-b border-white/10">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-medium text-white/60">
                      Contact
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-white/60">
                      Department
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-white/60">
                      Tags
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-white/60">
                      Status
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-white/60">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {contacts.map((contact) => (
                    <tr
                      key={contact.id}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                            <span className="text-sm font-semibold text-white">
                              {getInitials(contact.name)}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white">
                              {contact.name}
                            </p>
                            <p className="text-xs text-white/50 flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {contact.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {contact.department ? (
                          <span className="inline-flex items-center gap-1 text-sm text-white/70">
                            <Building2 className="h-3 w-3" />
                            {contact.department}
                          </span>
                        ) : (
                          <span className="text-white/30">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {contact.tags && contact.tags.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {contact.tags.map((tag) => (
                              <span
                                key={tag}
                                className="px-2 py-1 text-xs bg-white/10 text-white/60 rounded-full"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-white/30">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full ${
                            contact.isActive
                              ? "bg-green-500/10 text-green-400 border border-green-500/30"
                              : "bg-white/5 text-white/40 border border-white/10"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              contact.isActive ? "bg-green-400" : "bg-white/30"
                            }`}
                          />
                          {contact.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/dashboard/contacts/${contact.id}/edit`}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-white/60 hover:text-white h-8 w-8 p-0"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-white/60 hover:text-red-400 h-8 w-8 p-0"
                            onClick={() => setShowDeleteConfirm(contact.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="bg-white/[0.02] border border-white/10 rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-white mb-2">Delete Contact?</h3>
            <p className="text-white/60 mb-6">
              This action cannot be undone. Are you sure you want to delete this contact?
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                className="border-white/20 text-white hover:bg-white/5"
                onClick={() => setShowDeleteConfirm(null)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={() => handleDelete(showDeleteConfirm)}
                disabled={deleting}
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Delete"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
