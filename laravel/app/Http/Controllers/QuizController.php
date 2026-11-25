<?php

namespace App\Http\Controllers;

use App\Models\QuizSet;
use App\Models\Notebook;
use Illuminate\Http\Request;

class QuizController extends Controller
{
    public function index(Request $request)
    {
        $quizzes = $request->user()->quizSets()->with('questions')->latest()->get();

        return response()->json([
            'status' => 'success',
            'data' => $quizzes,
        ]);
    }

    public function generateWithAi(Request $request)
    {
        $validated = $request->validate([
            'notebook_id' => 'required|exists:notebooks,id',
            'title' => 'required|string|max:255',
        ]);

        $notebook = Notebook::findOrFail($validated['notebook_id']);
        if ($notebook->user_id !== $request->user()->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $quiz = $request->user()->quizSets()->create([
            'notebook_id' => $validated['notebook_id'],
            'title' => $validated['title'],
            'best_score' => 0,
            'questions_count' => 3,
        ]);

        $questions = [
            [
                'type' => 'multiple-choice',
                'question' => 'Which loss function is commonly used for binary classification tasks?',
                'options' => ['Binary Cross-Entropy', 'Mean Squared Error', 'Huber Loss', 'Categorical Cross-Entropy'],
                'correct_answer' => 'Binary Cross-Entropy',
                'explanation' => 'Binary Cross-Entropy calculates the logarithmic loss for two-class target outputs.',
            ],
            [
                'type' => 'true-false',
                'question' => 'L2 regularization adds the sum of absolute weight values to the cost function.',
                'options' => ['True', 'False'],
                'correct_answer' => 'False',
                'explanation' => 'L2 adds squared weight values (Ridge penalty), while L1 adds absolute values (Lasso penalty).',
            ],
            [
                'type' => 'multiple-choice',
                'question' => 'What problem does ReLU activation help alleviate compared to Sigmoid?',
                'options' => ['Vanishing Gradient Problem', 'Overfitting', 'High Variance', 'Data Imbalance'],
                'correct_answer' => 'Vanishing Gradient Problem',
                'explanation' => 'ReLU has a constant derivative of 1 for positive inputs, preventing vanishing gradients in deep networks.',
            ],
        ];

        foreach ($questions as $q) {
            $quiz->questions()->create($q);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'AI Practice Exam generated',
            'data' => $quiz->load('questions'),
        ], 201);
    }

    public function submitResults(Request $request, QuizSet $quiz)
    {
        if ($quiz->user_id !== $request->user()->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'score' => 'required|integer|min:0|max:100',
        ]);

        $bestScore = max($quiz->best_score, $validated['score']);
        $quiz->update([
            'best_score' => $bestScore,
            'last_taken_at' => now(),
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Quiz result submitted',
            'best_score' => $bestScore,
        ]);
    }

    public function destroy(Request $request, QuizSet $quiz)
    {
        if ($quiz->user_id !== $request->user()->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $quiz->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Quiz deleted',
        ]);
    }
}
