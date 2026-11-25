<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\NotebookController;
use App\Http\Controllers\DocumentController;
use App\Http\Controllers\NoteController;
use App\Http\Controllers\FlashcardController;
use App\Http\Controllers\QuizController;
use App\Http\Controllers\AdminController;

/*
|--------------------------------------------------------------------------
| API Routes - StudyLMS RESTful API with Laravel Sanctum
|--------------------------------------------------------------------------
*/

// Public Authentication Routes
Route::prefix('v1/auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
});

// Protected REST Routes (Requires Sanctum Bearer Token)
Route::middleware('auth:sanctum')->prefix('v1')->group(function () {
    // User Profile
    Route::get('/auth/user', [AuthController::class, 'userProfile']);
    Route::put('/auth/profile', [AuthController::class, 'updateProfile']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);

    // Notebook Workspaces CRUD
    Route::apiResource('notebooks', NotebookController::class);

    // Documents & Vector Sources
    Route::get('/notebooks/{notebook}/documents', [DocumentController::class, 'index']);
    Route::post('/documents/upload', [DocumentController::class, 'uploadAndProcess']);
    Route::delete('/documents/{document}', [DocumentController::class, 'destroy']);

    // Notion-style AI Notes
    Route::apiResource('notes', NoteController::class);
    Route::post('/notes/{note}/ai-action', [NoteController::class, 'executeAiAction']);

    // Quizlet Flashcard Decks
    Route::apiResource('flashcards', FlashcardController::class);
    Route::post('/flashcards/generate-ai', [FlashcardController::class, 'generateWithAi']);
    Route::post('/flashcards/{set}/mastery', [FlashcardController::class, 'updateMastery']);

    // Practice Quizzes
    Route::apiResource('quizzes', QuizController::class);
    Route::post('/quizzes/generate-ai', [QuizController::class, 'generateWithAi']);
    Route::post('/quizzes/{quiz}/submit', [QuizController::class, 'submitResults']);

    // Admin Metrics & Control (Educators & Admins)
    Route::middleware('can:access-admin')->prefix('admin')->group(function () {
        Route::get('/metrics', [AdminController::class, 'getSystemMetrics']);
        Route::get('/users', [AdminController::class, 'listUsers']);
        Route::put('/users/{user}/status', [AdminController::class, 'updateUserStatus']);
    });
});
