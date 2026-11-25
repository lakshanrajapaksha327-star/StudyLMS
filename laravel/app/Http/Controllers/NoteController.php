<?php

namespace App\Http\Controllers;

use App\Models\Note;
use App\Models\Notebook;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class NoteController extends Controller
{
    public function index(Request $request)
    {
        $notes = $request->user()->notes()->latest()->get();

        return response()->json([
            'status' => 'success',
            'data' => $notes,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'notebook_id' => 'required|exists:notebooks,id',
            'title' => 'required|string|max:255',
            'content' => 'required|string',
            'tags' => 'nullable|array',
        ]);

        $notebook = Notebook::findOrFail($validated['notebook_id']);
        if ($notebook->user_id !== $request->user()->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $note = $request->user()->notes()->create([
            'notebook_id' => $validated['notebook_id'],
            'title' => $validated['title'],
            'content' => $validated['content'],
            'tags' => $validated['tags'] ?? ['Study'],
        ]);

        return response()->json([
            'status' => 'success',
            'data' => $note,
        ], 201);
    }

    public function update(Request $request, Note $note)
    {
        if ($note->user_id !== $request->user()->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'title' => 'sometimes|string|max:255',
            'content' => 'sometimes|string',
            'tags' => 'nullable|array',
        ]);

        $note->update($validated);

        return response()->json([
            'status' => 'success',
            'data' => $note,
        ]);
    }

    public function executeAiAction(Request $request, Note $note)
    {
        if ($note->user_id !== $request->user()->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'action' => 'required|string|in:summarize,expand,extract-key-terms,fix-grammar',
        ]);

        $apiKey = config('services.gemini.key', env('GEMINI_API_KEY'));
        $action = $validated['action'];
        $resultText = "Notion AI action processed for {$note->title}.";

        if ($apiKey) {
            try {
                $response = Http::withHeaders(['Content-Type' => 'application/json'])
                    ->post("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={$apiKey}", [
                        'contents' => [
                            [
                                'parts' => [
                                    ['text' => "Task: {$action} for note: {$note->content}"]
                                ]
                            ]
                        ]
                    ]);

                if ($response->successful()) {
                    $resultText = $response->json()['candidates'][0]['content']['parts'][0]['text'] ?? $resultText;
                }
            } catch (\Exception $e) {
                // Fallback result
            }
        }

        $note->update(['ai_summary' => $resultText]);

        return response()->json([
            'status' => 'success',
            'action' => $action,
            'result' => $resultText,
            'note' => $note,
        ]);
    }

    public function destroy(Request $request, Note $note)
    {
        if ($note->user_id !== $request->user()->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $note->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Note deleted successfully',
        ]);
    }
}
