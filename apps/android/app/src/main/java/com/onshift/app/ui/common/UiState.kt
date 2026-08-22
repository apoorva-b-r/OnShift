package com.onshift.app.ui.common

sealed interface UiState<out T> {
    object Loading : UiState<Nothing>
    data class Error(val message: String) : UiState<Nothing>
    object Empty : UiState<Nothing>
    data class Success<T>(val data: T) : UiState<T>
}
