<?php

namespace App\Http\Controllers;

use App\Models\Notebook;
use Illuminate\Http\Request;

class NotebookController extends Controller
{
    public function index(Request $request)
    {
        $notebooks = $request->user()->notebooks()->withCount(['documents', 'notes', 'flashcardSets', 'quizSets'])->latest()->get();

        return response()->json([
            'status' => 'success',
            'data' => $notebooks,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'icon' => 'nullable|string',
            'color' => 'nullable|string',
        ]);

        $notebook = $request->user()->notebooks()->create([
            'title' => $validated['title'],
            'description' => $validated['description'] ?? 'Study workspace notebook',
            'icon' => $validated['icon'] ?? 'BookOpen',
            'color' => $validated['color'] ?? 'indigo',
        ]);

        return response()->json([
            'status' => 'success',
            'data' => $notebook,
        ], 201);
    }

    public function show(Request $request, Notebook $notebook)
    {
        if ($notebook->user_id !== $request->user()->id) {
            return response()->json(['error' => 'Unauthorized access to notebook'], 403);
        }

        $notebook->load(['documents', 'notes', 'flashcardSets.cards', 'quizSets.questions']);

        return response()->json([
            'status' => 'success',
            'data' => $notebook,
        ]);
    }

    public function update(Request $request, Notebook $notebook)
    {
        if ($notebook->user_id !== $request->user()->id) {
            return response()->json(['error' => 'Unauthorized access'], 403);
        }

        $validated = $request->validate([
            'title' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'icon' => 'nullable|string',
            'color' => 'nullable|string',
        ]);

        $notebook->update($validated);

        return response()->json([
            'status' => 'success',
            'data' => $notebook,
        ]);
    }

    public function destroy(Request $request, Notebook $notebook)
    {
        if ($notebook->user_id !== $request->user()->id) {
            return response()->json(['error' => 'Unauthorized access'], 403);
        }

        $notebook->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Notebook deleted successfully',
        ]);
    }
}
