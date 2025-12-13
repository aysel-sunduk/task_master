import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 
  (Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000');

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatbotScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Merhaba! TaskMaster asistanınızım. Görev yönetimi konusunda size nasıl yardımcı olabilirim?',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    // Yeni mesaj geldiğinde scroll yap
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const sendMessage = async () => {
    if (!inputText.trim() || !token) return;

    const userMessage: Message = { role: 'user', content: inputText.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setLoading(true);

    try {
      const response = await axios.post(
        `${API_URL}/api/ai/chat`,
        {
          messages: [...messages, userMessage].map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const aiMessage: Message = {
        role: 'assistant',
        content: response.data.message,
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (error: any) {
      console.error('Chat hatası:', error);
      console.error('Chat hatası detayları:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
        url: error.config?.url
      });
      
      let errorContent = 'Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin.';
      
      if (error.response?.status === 429) {
        errorContent = 'AI servisi şu anda çok yoğun. Lütfen birkaç saniye sonra tekrar deneyin.';
      } else if (error.response?.status === 503) {
        errorContent = 'AI servisi şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.';
      } else if (error.response?.status === 504) {
        errorContent = 'AI servisi yanıt vermedi. Lütfen tekrar deneyin.';
      } else if (error.response?.data?.detail) {
        errorContent = error.response.data.detail;
      } else if (error.message) {
        errorContent = `Hata: ${error.message}`;
      }
      
      const errorMessage: Message = {
        role: 'assistant',
        content: errorContent,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const getQuickSuggestions = async () => {
    if (!token) return;

    setLoading(true);
    try {
      const response = await axios.post(
        `${API_URL}/api/ai/suggestions`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const suggestions = response.data;
      if (suggestions && suggestions.length > 0) {
        const suggestionText = suggestions.join('\n');
        setInputText(suggestionText);
      }
    } catch (error: any) {
      console.error('Öneriler alınırken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Ionicons name="sparkles" size={24} color="#6C63FF" />
          <Text style={styles.headerTitle}>AI Asistan</Text>
        </View>
        <TouchableOpacity onPress={getQuickSuggestions} style={styles.suggestButton}>
          <Ionicons name="bulb-outline" size={24} color="#6C63FF" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={90}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
        >
          {messages.map((message, index) => (
            <View
              key={index}
              style={[
                styles.messageBubble,
                message.role === 'user' ? styles.userMessage : styles.assistantMessage,
              ]}
            >
              <Text
                style={[
                  styles.messageText,
                  message.role === 'user' ? styles.userMessageText : styles.assistantMessageText,
                ]}
              >
                {message.content}
              </Text>
            </View>
          ))}
          {loading && (
            <View style={[styles.messageBubble, styles.assistantMessage]}>
              <ActivityIndicator size="small" color="#6C63FF" />
            </View>
          )}
        </ScrollView>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Mesajınızı yazın..."
            placeholderTextColor="#8E8E93"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
            editable={!loading}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!inputText.trim() || loading) && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={!inputText.trim() || loading}
          >
            <Ionicons name="send" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F1E',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C3E',
  },
  backButton: {
    padding: 8,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  suggestButton: {
    padding: 8,
  },
  chatContainer: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 20,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#6C63FF',
    borderBottomRightRadius: 4,
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#1C1C2E',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#2C2C3E',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  userMessageText: {
    color: '#FFFFFF',
  },
  assistantMessageText: {
    color: '#FFFFFF',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#2C2C3E',
    backgroundColor: '#0F0F1E',
  },
  input: {
    flex: 1,
    backgroundColor: '#1C1C2E',
    color: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#2C2C3E',
    marginRight: 8,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#6C63FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});

