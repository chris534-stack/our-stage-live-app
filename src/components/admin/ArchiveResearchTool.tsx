'use client';

import { useState, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, Upload, CheckCircle2, XCircle, AlertCircle, Library } from 'lucide-react';
import type { Venue } from '@/lib/types';
import type { ArchiveResearchOutput, ArchiveResearchInput } from '@/ai/flows/research-archive-show';

interface ArchiveResearchToolProps {
    venues: Venue[];
}

type ResearchResult = {
    input: ArchiveResearchInput;
    output?: ArchiveResearchOutput;
    error?: string;
    selected: boolean;
};

type InputMode = 'text' | 'url';

export function ArchiveResearchTool({ venues }: ArchiveResearchToolProps) {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

    // Input state
    const [inputMode, setInputMode] = useState<InputMode>('text');
    const [rawText, setRawText] = useState('');
    const [urlInput, setUrlInput] = useState('');
    const [defaultVenueId, setDefaultVenueId] = useState<string>('');

    // Parsed shows state
    const [parsedShows, setParsedShows] = useState<ArchiveResearchInput[]>([]);

    // Research results state
    const [results, setResults] = useState<ResearchResult[]>([]);
    const [researchProgress, setResearchProgress] = useState(0);
    const [isResearching, setIsResearching] = useState(false);

    // Import state
    const [isImporting, setIsImporting] = useState(false);

    // Token usage state
    const [usageStats, setUsageStats] = useState({
        inputTokens: 0,
        outputTokens: 0,
        totalCalls: 0
    });

    // Reset stats when starting new batch
    const resetStats = () => {
        setUsageStats({ inputTokens: 0, outputTokens: 0, totalCalls: 0 });
    };

    // Parse the raw text input
    const handleParseText = async () => {
        if (!rawText.trim()) {
            toast({ variant: 'destructive', title: 'No input', description: 'Please enter some show titles.' });
            return;
        }

        startTransition(async () => {
            try {
                const response = await fetch('/api/admin/archive-research', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ parseText: true, rawText }),
                });

                const data = await response.json();

                if (data.success && data.shows) {
                    setParsedShows(data.shows);
                    setResults([]);
                    resetStats(); // Reset stats on new parse
                    toast({
                        title: 'Shows parsed',
                        description: `Found ${data.count} shows to research.`
                    });
                } else {
                    throw new Error(data.error || 'Failed to parse shows');
                }
            } catch (error: any) {
                toast({
                    variant: 'destructive',
                    title: 'Parse failed',
                    description: error.message
                });
            }
        });
    };

    // Research all parsed shows
    const handleResearchAll = async () => {
        if (parsedShows.length === 0) {
            toast({ variant: 'destructive', title: 'No shows', description: 'Please parse some show titles first.' });
            return;
        }

        if (!defaultVenueId) {
            toast({
                variant: 'destructive',
                title: 'Venue Required',
                description: 'Please select a specific venue above to help the AI ground its research.'
            });
            return;
        }

        setIsResearching(true);
        setResearchProgress(0);
        resetStats();
        const newResults: ResearchResult[] = [];

        // Process shows one at a time to show progress
        for (let i = 0; i < parsedShows.length; i++) {
            const show = parsedShows[i];

            try {
                const response = await fetch('/api/admin/archive-research', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...show,
                        // Note: Default venue is passed here for researching context
                        venue: defaultVenueId ? venues.find(v => v.id === defaultVenueId)?.name : show.venue,
                    }),
                });

                const data = await response.json();

                // Update token stats
                if (data.meta?.usage) {
                    setUsageStats(prev => ({
                        inputTokens: prev.inputTokens + (data.meta.usage.inputTokens || 0),
                        outputTokens: prev.outputTokens + (data.meta.usage.outputTokens || 0),
                        totalCalls: prev.totalCalls + 1
                    }));
                }

                if (data.success && data.data) {
                    newResults.push({
                        input: show,
                        output: data.data,
                        selected: true,
                    });
                } else {
                    newResults.push({
                        input: show,
                        error: data.error || 'Unknown error',
                        selected: false,
                    });
                }
            } catch (error: any) {
                newResults.push({
                    input: show,
                    error: error.message || 'Network error',
                    selected: false,
                });
            }

            setResults([...newResults]);
            setResearchProgress(((i + 1) / parsedShows.length) * 100);
        }

        setIsResearching(false);
        toast({
            title: 'Research complete',
            description: `Processed ${parsedShows.length} shows. ${newResults.filter(r => r.output).length} successful.`
        });
    };

    // ... (Selection methods remain same) ...
    // Toggle selection of a result
    const toggleResultSelection = (index: number) => {
        setResults(prev => prev.map((r, i) =>
            i === index ? { ...r, selected: !r.selected } : r
        ));
    };

    // Select all with output
    const selectAllWithOutput = () => {
        setResults(prev => prev.map(r => ({ ...r, selected: !!r.output })));
    };

    // Deselect all
    const deselectAll = () => {
        setResults(prev => prev.map(r => ({ ...r, selected: false })));
    };

    // Import selected results
    const handleImportSelected = async () => {
        // ... (Import logic remains the same, verified in Step 421) ...
        const selectedResults = results.filter(r => r.selected && r.output);

        if (selectedResults.length === 0) {
            toast({ variant: 'destructive', title: 'No selection', description: 'Please select some shows to import.' });
            return;
        }

        if (!defaultVenueId) {
            toast({ variant: 'destructive', title: 'No venue', description: 'Please select a venue before importing.' });
            return;
        }

        setIsImporting(true);

        try {
            const eventsToImport = selectedResults.map(r => {
                const occurrences = [];
                if (r.output?.dateStart) {
                    occurrences.push({
                        date: r.output.dateStart,
                        time: '19:30' // Approximate curtain time if unknown
                    });
                } else if (r.input.year) {
                    occurrences.push({
                        date: `${r.input.year}-01-01`,
                        time: ''
                    });
                }

                return {
                    title: r.output!.title,
                    description: r.output!.description,
                    venueId: defaultVenueId,
                    type: r.output!.type,
                    tags: r.output!.tags,
                    playwright: r.output!.playwright,
                    composer: r.output!.composer,
                    director: r.output!.director,
                    originalProductionYear: r.output!.originalYear ?? r.input.year,
                    researchConfidence: r.output!.researchConfidence,
                    occurrences,
                };
            });

            const response = await fetch('/api/admin/archive-import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ events: eventsToImport }),
            });

            const data = await response.json();

            if (data.success) {
                toast({
                    title: 'Import successful',
                    description: `Imported ${data.summary.imported} shows to the archive.`
                });

                // Clear imported results
                setResults(prev => prev.filter(r => !r.selected));
            } else {
                throw new Error(data.error || 'Import failed');
            }
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Import failed',
                description: error.message
            });
        } finally {
            setIsImporting(false);
        }
    };

    // ... (Helper methods) ...
    const getConfidenceBadge = (confidence: string) => {
        switch (confidence) {
            case 'high':
                return <Badge className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" />High</Badge>;
            case 'medium':
                return <Badge className="bg-yellow-500"><AlertCircle className="w-3 h-3 mr-1" />Medium</Badge>;
            case 'low':
                return <Badge className="bg-red-500"><XCircle className="w-3 h-3 mr-1" />Low</Badge>;
            default:
                return <Badge variant="secondary">Unknown</Badge>;
        }
    };

    const selectedCount = results.filter(r => r.selected && r.output).length;

    // Estimate cost (based on generic Flash rates: $0.075/1M Input, $0.30/1M Output)
    const estimatedCost = (
        (usageStats.inputTokens / 1_000_000) * 0.075 +
        (usageStats.outputTokens / 1_000_000) * 0.30
    ).toFixed(4);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold font-headline mb-2 flex items-center gap-2">
                    <Library className="h-6 w-6" />
                    Archive Research Tool
                </h2>
                <p className="text-muted-foreground">
                    Research historical theatre productions and backfill the archive with enriched data.
                </p>
                {usageStats.totalCalls > 0 && (
                    <div className="mt-2 flex gap-4 text-xs font-mono text-muted-foreground border p-2 rounded-md inline-flex bg-slate-50">
                        <span>Calls: {usageStats.totalCalls}</span>
                        <span>In: {usageStats.inputTokens.toLocaleString()}</span>
                        <span>Out: {usageStats.outputTokens.toLocaleString()}</span>
                        <span className="font-bold text-green-700">Cost: ${estimatedCost}</span>
                    </div>
                )}
            </div>

            {/* Input Section */}
            {/* ... (Rest remains same until render) ... */}
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline">Input Shows</CardTitle>
                    <CardDescription>
                        Enter a list of show titles to research. One show per line. Optionally include year: "Show Title (2019)"
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Default Venue</Label>
                        <Select value={defaultVenueId} onValueChange={setDefaultVenueId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a venue..." />
                            </SelectTrigger>
                            <SelectContent>
                                {venues.map(venue => (
                                    <SelectItem key={venue.id} value={venue.id}>
                                        {venue.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Show List</Label>
                        <Textarea
                            placeholder={`A Christmas Carol (2019)
The Sound of Music (2018)
Romeo and Juliet by Shakespeare
Oklahoma!`}
                            value={rawText}
                            onChange={(e) => setRawText(e.target.value)}
                            rows={8}
                            className="font-mono text-sm"
                        />
                    </div>

                    <div className="flex gap-2">
                        <Button onClick={handleParseText} disabled={isPending || !rawText.trim()}>
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Parse Shows
                        </Button>
                        {parsedShows.length > 0 && (
                            <Button
                                variant="default"
                                onClick={handleResearchAll}
                                disabled={isResearching}
                            >
                                {isResearching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                <Search className="mr-2 h-4 w-4" />
                                Research All ({parsedShows.length})
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Parsed Shows Preview */}
            {parsedShows.length > 0 && results.length === 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="font-headline">Parsed Shows ({parsedShows.length})</CardTitle>
                        <CardDescription>Review the parsed shows before researching</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                            {parsedShows.map((show, i) => (
                                <div key={i} className="flex items-center gap-2 p-2 bg-muted rounded-md">
                                    <span className="font-medium">{show.title}</span>
                                    {show.year && <Badge variant="outline">{show.year}</Badge>}
                                    {show.additionalContext && (
                                        <span className="text-sm text-muted-foreground">{show.additionalContext}</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Research Progress */}
            {isResearching && (
                <Card>
                    <CardContent className="pt-6">
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span>Researching shows...</span>
                                <span>{Math.round(researchProgress)}%</span>
                            </div>
                            <Progress value={researchProgress} />
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Results Section */}
            {results.length > 0 && (
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="font-headline">Research Results ({results.length})</CardTitle>
                                <CardDescription>
                                    {selectedCount} selected for import
                                </CardDescription>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={selectAllWithOutput}>
                                    Select All
                                </Button>
                                <Button variant="outline" size="sm" onClick={deselectAll}>
                                    Deselect All
                                </Button>
                                <div className="flex flex-col items-end gap-1">
                                    <Button
                                        onClick={handleImportSelected}
                                        disabled={isImporting || selectedCount === 0 || !defaultVenueId}
                                    >
                                        {isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        <Upload className="mr-2 h-4 w-4" />
                                        Import Selected ({selectedCount})
                                    </Button>
                                    {!defaultVenueId && selectedCount > 0 && (
                                        <span className="text-xs text-red-500 font-medium animate-pulse">
                                            Select a Default Venue above to enable import
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4 max-h-[600px] overflow-y-auto">
                            {results.map((result, index) => (
                                <div
                                    key={index}
                                    className={`border rounded-lg p-4 ${result.error ? 'border-red-200 bg-red-50' : 'border-gray-200'}`}
                                >
                                    <div className="flex items-start gap-3">
                                        <Checkbox
                                            checked={result.selected}
                                            onCheckedChange={() => toggleResultSelection(index)}
                                            disabled={!!result.error}
                                        />
                                        <div className="flex-1 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <h4 className="font-semibold">
                                                    {result.output?.title ?? result.input.title}
                                                </h4>
                                                {result.output && getConfidenceBadge(result.output.researchConfidence)}
                                                {result.error && <Badge variant="destructive">Error</Badge>}
                                            </div>

                                            {result.error && (
                                                <p className="text-sm text-red-600">{result.error}</p>
                                            )}

                                            {result.output && (
                                                <>
                                                    <p className="text-sm text-muted-foreground">
                                                        {result.output.description}
                                                    </p>

                                                    <div className="flex flex-wrap gap-2 text-xs">
                                                        <Badge variant="outline">{result.output.type}</Badge>
                                                        {result.output.playwright && (
                                                            <Badge variant="secondary">By: {result.output.playwright}</Badge>
                                                        )}
                                                        {result.output.dateStart && (
                                                            <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200">
                                                                Run: {result.output.dateStart} {result.output.dateEnd ? `to ${result.output.dateEnd}` : ''}
                                                            </Badge>
                                                        )}
                                                        {result.output.originalYear && (
                                                            <Badge variant="secondary">Original: {result.output.originalYear}</Badge>
                                                        )}
                                                        {result.output.tags?.map((tag, i) => (
                                                            <Badge key={i} variant="secondary">{tag}</Badge>
                                                        ))}
                                                    </div>

                                                    {result.output.reasoning && (
                                                        <div className="text-xs bg-muted p-2 rounded italic text-muted-foreground">
                                                            AI Reasoning: {result.output.reasoning}
                                                        </div>
                                                    )}

                                                    {result.output.synopsis && (
                                                        <details className="text-sm">
                                                            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                                                Synopsis
                                                            </summary>
                                                            <p className="mt-2 pl-4 border-l-2">{result.output.synopsis}</p>
                                                        </details>
                                                    )}

                                                    {result.output.historicalContext && (
                                                        <details className="text-sm">
                                                            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                                                Historical Context
                                                            </summary>
                                                            <p className="mt-2 pl-4 border-l-2">{result.output.historicalContext}</p>
                                                        </details>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
