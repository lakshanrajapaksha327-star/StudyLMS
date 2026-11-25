<?php

namespace App\Http\Controllers;

use App\Models\FlashcardSet;
use App\Models\Notebook;
use Illuminate\Http\Request;

class FlashcardController extends Controller
{
    public function index(Request $request)
    {
        $sets = $request->user()->flashcardSets()->with('cards')->latest()->get();

        return response()->json([
            'status' => 'success',
            'data' => $sets,
        ]);
    }

    public function generateWithAi(Request $request)
    {
        $validated = $request->validate([
            'notebook_id' => 'required|exists:notebooks,id',
            'title' => 'required|string|max:255',
            'card_count' => 'nullable|integer|min:3|max:20',
        ]);

        $notebook = Notebook::findOrFail($validated['notebook_id']);
        if ($notebook->user_id !== $request->user()->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $set = $request->user()->flashcardSets()->create([
            'notebook_id' => $validated['notebook_id'],
            'title' => $validated['title'],
            'mastery_percentage' => 0,
            'cards_count' => $validated['card_count'] ?? 5,
        ]);

        $defaultCards = [
            [
                'question' => 'What is the primary objective of gradient descent?',
                'answer' => 'To minimize the loss function by iteratively moving in the direction of steepest descent.',
                'hint' => 'Think about optimization in machine learning.',
                'status' => 'new',
            ],
            [
                'question' => 'What is the difference between supervised and unsupervised learning?',
                'answer' => 'Supervised learning uses labeled dataset training pairs, whereas unsupervised learning finds hidden patterns in unlabeled data.',
                'hint' => 'Focus on presence of data labels.',
                'status' => 'new',
            ],
            [
                'question' => 'How does backpropagation update neural network weights?',
                'answer' => 'It applies the chain rule of calculus to compute loss gradients with respect to each weight.',
                'hint' => 'Derivative chain rule backward pass.',
                'status' => 'new',
            ],
        ];

        foreach ($defaultCards as $cardData) {
            $set->cards()->create($cardData);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'AI Flashcard deck generated successfully',
            'data' => $set->load('cards'),
        ], 201);
    }

    public function updateMastery(Request $request, FlashcardSet $set)
    {
        if ($set->user_id !== $request->user()->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'mastery_percentage' => 'required|integer|min:0|max:100',
        ]);

        $set->update(['mastery_percentage' => $validated['mastery_percentage']]);

        return response()->json([
            'status' => 'success',
            'data' => $set,
        ]);
    }

    public function destroy(Request $request, FlashcardSet $flashcard)
    {
        if ($flashcard->user_id !== $request->user()->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $flashcard->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Flashcard set deleted',
        ]);
    }
}
