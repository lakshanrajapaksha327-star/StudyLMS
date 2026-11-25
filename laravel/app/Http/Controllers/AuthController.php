<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * Register a new user and issue a Laravel Sanctum Bearer token.
     */
    public function register(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:8',
            'role' => 'nullable|string|in:Student,Educator,Admin',
        ]);

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'role' => $validated['role'] ?? 'Student',
            'status' => 'Active',
            'study_goal_minutes' => 60,
            'preferred_ai_model' => 'Gemini 2.5 Flash',
            'study_streak_days' => 1,
            'ai_tokens_consumed' => 0,
        ]);

        $token = $user->createToken('studylms_auth_token')->plainTextToken;

        return response()->json([
            'status' => 'success',
            'message' => 'User account created successfully',
            'access_token' => $token,
            'token_type' => 'Bearer',
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
            ],
        ], 201);
    }

    /**
     * Authenticate user with email and password via Sanctum.
     */
    public function login(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        $user = User::where('email', $request->email)->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['Invalid email or password credentials.'],
            ]);
        }

        if ($user->status === 'Suspended') {
            return response()->json([
                'status' => 'error',
                'message' => 'Your account has been suspended by an administrator.',
            ], 403);
        }

        $token = $user->createToken('studylms_auth_token')->plainTextToken;

        return response()->json([
            'status' => 'success',
            'message' => 'Authenticated successfully',
            'access_token' => $token,
            'token_type' => 'Bearer',
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'study_goal_minutes' => $user->study_goal_minutes,
                'preferred_ai_model' => $user->preferred_ai_model,
            ],
        ]);
    }

    /**
     * Get current authenticated user profile details.
     */
    public function userProfile(Request $request)
    {
        return response()->json([
            'status' => 'success',
            'user' => $request->user(),
        ]);
    }

    /**
     * Update authenticated user profile settings.
     */
    public function updateProfile(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'study_goal_minutes' => 'sometimes|integer|min:15|max:300',
            'preferred_ai_model' => 'sometimes|string',
        ]);

        $user->update($validated);

        return response()->json([
            'status' => 'success',
            'message' => 'Profile settings updated',
            'user' => $user,
        ]);
    }

    /**
     * Revoke Sanctum access token (Logout).
     */
    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Sanctum token revoked successfully',
        ]);
    }

    /**
     * Password reset placeholder route
     */
    public function forgotPassword(Request $request)
    {
        $request->validate(['email' => 'required|email']);
        return response()->json([
            'status' => 'success',
            'message' => 'Password reset link sent to ' . $request->email,
        ]);
    }
}
