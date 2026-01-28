'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Edit2, Check, X } from 'lucide-react';
import { TAX_PRESETS, getTaxPresetsByCountry } from '@/lib/tax-presets';

interface TaxRule {
  id?: string;
  name: string;
  rate: number;
  authority?: string;
  isActive?: boolean;
}

interface TaxProfile {
  id: string;
  name: string;
  countryCode: string;
  regionCode?: string;
  isDefault: boolean;
  taxRules: TaxRule[];
}

export function TaxProfileSettings() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<TaxProfile | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string>('');

  // Fetch tax profiles
  const { data: taxProfiles = [], isLoading } = useQuery<TaxProfile[]>({
    queryKey: ['tax-profiles'],
    queryFn: async () => {
      const response = await fetch('/api/tax/profiles');
      if (!response.ok) throw new Error('Failed to fetch tax profiles');
      return response.json();
    }
  });

  // Fetch tax presets
  const { data: presetsData } = useQuery({
    queryKey: ['tax-presets'],
    queryFn: async () => {
      const response = await fetch('/api/tax/presets');
      if (!response.ok) throw new Error('Failed to fetch tax presets');
      return response.json();
    }
  });

  const presets = presetsData?.presets || TAX_PRESETS;

  // Create tax profile mutation
  const createMutation = useMutation({
    mutationFn: async (profile: Partial<TaxProfile>) => {
      const response = await fetch('/api/tax/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile)
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create tax profile');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tax-profiles'] });
      setIsDialogOpen(false);
      setEditingProfile(null);
      setSelectedPreset('');
      toast.success('Tax profile created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create tax profile');
    }
  });

  // Update tax profile mutation
  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      ...profile
    }: Partial<TaxProfile> & { id: string }) => {
      const response = await fetch(`/api/tax/profiles/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile)
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update tax profile');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tax-profiles'] });
      setIsDialogOpen(false);
      setEditingProfile(null);
      setSelectedPreset('');
      toast.success('Tax profile updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update tax profile');
    }
  });

  // Delete tax profile mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/tax/profiles/${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete tax profile');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tax-profiles'] });
      toast.success('Tax profile deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete tax profile');
    }
  });

  const handlePresetSelect = (presetId: string) => {
    const preset = presets.find((p: any) => p.id === presetId);
    if (preset) {
      setEditingProfile({
        id: '',
        name: preset.name,
        countryCode: preset.countryCode,
        regionCode: preset.regionCode,
        isDefault: false,
        taxRules: preset.taxRules.map((rule: any) => ({
          name: rule.name,
          rate: rule.rate,
          authority: rule.authority
        }))
      });
      setSelectedPreset(presetId);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProfile) return;

    const profileData = {
      name: editingProfile.name,
      countryCode: editingProfile.countryCode,
      regionCode: editingProfile.regionCode || null,
      isDefault: editingProfile.isDefault,
      taxRules: editingProfile.taxRules
    };

    if (editingProfile.id) {
      updateMutation.mutate({ id: editingProfile.id, ...profileData });
    } else {
      createMutation.mutate(profileData);
    }
  };

  const handleAddRule = () => {
    if (!editingProfile) return;
    setEditingProfile({
      ...editingProfile,
      taxRules: [
        ...editingProfile.taxRules,
        { name: '', rate: 0, authority: '' }
      ]
    });
  };

  const handleRemoveRule = (index: number) => {
    if (!editingProfile) return;
    setEditingProfile({
      ...editingProfile,
      taxRules: editingProfile.taxRules.filter((_, i) => i !== index)
    });
  };

  const handleRuleChange = (
    index: number,
    field: keyof TaxRule,
    value: any
  ) => {
    if (!editingProfile) return;
    const newRules = [...editingProfile.taxRules];
    newRules[index] = { ...newRules[index], [field]: value };
    setEditingProfile({ ...editingProfile, taxRules: newRules });
  };

  return (
    <Card>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <div>
            <CardTitle>Tax Profiles</CardTitle>
            <CardDescription>
              Configure tax rates for different jurisdictions. These will be
              used as defaults for invoices.
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={() => {
                  setEditingProfile({
                    id: '',
                    name: '',
                    countryCode: '',
                    regionCode: '',
                    isDefault: false,
                    taxRules: [{ name: '', rate: 0, authority: '' }]
                  });
                  setSelectedPreset('');
                }}
              >
                <Plus className='mr-2 h-4 w-4' />
                Add Tax Profile
              </Button>
            </DialogTrigger>
            <DialogContent className='max-h-[90vh] max-w-2xl overflow-y-auto'>
              <DialogHeader>
                <DialogTitle>
                  {editingProfile?.id
                    ? 'Edit Tax Profile'
                    : 'Create Tax Profile'}
                </DialogTitle>
                <DialogDescription>
                  Create a tax profile with one or more tax rules (e.g., GST +
                  PST).
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className='space-y-4'>
                {/* Preset Selector */}
                <div>
                  <Label>Start from a preset (optional)</Label>
                  <Select
                    value={selectedPreset}
                    onValueChange={handlePresetSelect}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder='Select a preset...' />
                    </SelectTrigger>
                    <SelectContent>
                      {presets.map((preset: any) => (
                        <SelectItem key={preset.id} value={preset.id}>
                          {preset.name} - {preset.description}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedPreset && (
                    <p className='text-muted-foreground mt-1 text-xs'>
                      {
                        presets.find((p: any) => p.id === selectedPreset)
                          ?.disclaimer
                      }
                    </p>
                  )}
                </div>

                {/* Profile Details */}
                <div className='grid grid-cols-2 gap-4'>
                  <div>
                    <Label htmlFor='name'>Profile Name *</Label>
                    <Input
                      id='name'
                      value={editingProfile?.name || ''}
                      onChange={(e) =>
                        setEditingProfile({
                          ...editingProfile!,
                          name: e.target.value
                        })
                      }
                      placeholder='e.g., Canada - Quebec'
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor='countryCode'>Country Code *</Label>
                    <Input
                      id='countryCode'
                      value={editingProfile?.countryCode || ''}
                      onChange={(e) =>
                        setEditingProfile({
                          ...editingProfile!,
                          countryCode: e.target.value.toUpperCase()
                        })
                      }
                      placeholder='CA, US, GB, etc.'
                      maxLength={2}
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor='regionCode'>Region Code (optional)</Label>
                  <Input
                    id='regionCode'
                    value={editingProfile?.regionCode || ''}
                    onChange={(e) =>
                      setEditingProfile({
                        ...editingProfile!,
                        regionCode: e.target.value || undefined
                      })
                    }
                    placeholder='QC, CA, NY, etc.'
                  />
                </div>

                {/* Tax Rules */}
                <div>
                  <div className='mb-2 flex items-center justify-between'>
                    <Label>Tax Rules *</Label>
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      onClick={handleAddRule}
                    >
                      <Plus className='mr-1 h-4 w-4' />
                      Add Rule
                    </Button>
                  </div>
                  <div className='space-y-2'>
                    {editingProfile?.taxRules.map((rule, index) => (
                      <div key={index} className='flex items-end gap-2'>
                        <div className='flex-1'>
                          <Input
                            placeholder='Tax name (e.g., GST, VAT)'
                            value={rule.name}
                            onChange={(e) =>
                              handleRuleChange(index, 'name', e.target.value)
                            }
                            required
                          />
                        </div>
                        <div className='w-24'>
                          <Input
                            type='number'
                            step='0.01'
                            placeholder='Rate %'
                            value={rule.rate || ''}
                            onChange={(e) =>
                              handleRuleChange(
                                index,
                                'rate',
                                parseFloat(e.target.value) || 0
                              )
                            }
                            required
                          />
                        </div>
                        <div className='w-32'>
                          <Select
                            value={rule.authority || ''}
                            onValueChange={(value) =>
                              handleRuleChange(
                                index,
                                'authority',
                                value || null
                              )
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder='Authority' />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value='federal'>Federal</SelectItem>
                              <SelectItem value='state'>State</SelectItem>
                              <SelectItem value='provincial'>
                                Provincial
                              </SelectItem>
                              <SelectItem value='vat'>VAT</SelectItem>
                              <SelectItem value='local'>Local</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          type='button'
                          variant='ghost'
                          size='icon'
                          onClick={() => handleRemoveRule(index)}
                        >
                          <Trash2 className='h-4 w-4' />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Default checkbox */}
                <div className='flex items-center space-x-2'>
                  <input
                    type='checkbox'
                    id='isDefault'
                    checked={editingProfile?.isDefault || false}
                    onChange={(e) =>
                      setEditingProfile({
                        ...editingProfile!,
                        isDefault: e.target.checked
                      })
                    }
                    className='rounded border-gray-300'
                  />
                  <Label htmlFor='isDefault'>Set as default tax profile</Label>
                </div>

                <div className='flex justify-end gap-2'>
                  <Button
                    type='button'
                    variant='outline'
                    onClick={() => {
                      setIsDialogOpen(false);
                      setEditingProfile(null);
                      setSelectedPreset('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type='submit'
                    disabled={
                      createMutation.isPending ||
                      updateMutation.isPending ||
                      !editingProfile?.name ||
                      !editingProfile?.countryCode ||
                      editingProfile.taxRules.length === 0
                    }
                  >
                    {editingProfile?.id ? 'Update' : 'Create'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className='text-muted-foreground py-8 text-center'>
            Loading tax profiles...
          </div>
        ) : taxProfiles.length === 0 ? (
          <div className='text-muted-foreground py-8 text-center'>
            No tax profiles configured. Create one to get started.
          </div>
        ) : (
          <div className='space-y-4'>
            {taxProfiles.map((profile) => (
              <div key={profile.id} className='space-y-2 rounded-lg border p-4'>
                <div className='flex items-center justify-between'>
                  <div>
                    <div className='flex items-center gap-2'>
                      <h3 className='font-semibold'>{profile.name}</h3>
                      {profile.isDefault && (
                        <Badge variant='default'>Default</Badge>
                      )}
                    </div>
                    <p className='text-muted-foreground text-sm'>
                      {profile.countryCode}
                      {profile.regionCode && ` - ${profile.regionCode}`}
                    </p>
                  </div>
                  <div className='flex gap-2'>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={() => {
                        setEditingProfile(profile);
                        setIsDialogOpen(true);
                      }}
                    >
                      <Edit2 className='h-4 w-4' />
                    </Button>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={() => {
                        if (
                          confirm(
                            'Are you sure you want to delete this tax profile?'
                          )
                        ) {
                          deleteMutation.mutate(profile.id);
                        }
                      }}
                    >
                      <Trash2 className='h-4 w-4' />
                    </Button>
                  </div>
                </div>
                <div className='space-y-1'>
                  {profile.taxRules.map((rule, index) => (
                    <div
                      key={index}
                      className='flex items-center gap-2 text-sm'
                    >
                      <span className='font-medium'>{rule.name}:</span>
                      <span>{rule.rate}%</span>
                      {rule.authority && (
                        <Badge variant='outline' className='text-xs'>
                          {rule.authority}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
