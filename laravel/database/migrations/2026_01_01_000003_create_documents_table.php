<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('notebook_id')->constrained()->onDelete('cascade');
            $table->string('title');
            $table->string('type')->default('text');
            $table->longText('content');
            $table->text('summary')->nullable();
            $table->json('key_concepts')->nullable();
            $table->string('file_path')->nullable();
            $table->integer('file_size')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('documents');
    }
};
