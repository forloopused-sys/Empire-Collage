
"use client";
import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, Send, Sparkles, Loader2, User } from 'lucide-react';
import { runChat } from '@/actions/chat';
import { useAuth } from '@/hooks/use-auth-provider';

type Message = {
    role: 'user' | 'model';
    content: { text: string }[];
};

export function Chatbot() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const [position, setPosition] = useState({ x: 20, y: window.innerHeight - 80 });
    const isDragging = useRef(false);
    const fabRef = useRef<HTMLButtonElement>(null);
    
    const { userProfile } = useAuth();

    const handleMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
        isDragging.current = true;
        fabRef.current?.classList.add('cursor-grabbing');
    };

    const handleMouseUp = (e: MouseEvent) => {
        isDragging.current = false;
        fabRef.current?.classList.remove('cursor-grabbing');
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging.current) return;
        setPosition(prev => ({
            x: Math.max(0, Math.min(window.innerWidth - 60, prev.x + e.movementX)),
            y: Math.max(0, Math.min(window.innerHeight - 60, prev.y + e.movementY))
        }));
    };

    useEffect(() => {
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);
    
    useEffect(() => {
        if (isOpen && messages.length === 0) {
            setMessages([
                { role: 'model', content: [{ text: `Hi ${userProfile?.name}! I'm Sparky, your AI learning assistant. How can I help you today?` }] }
            ]);
        }
    }, [isOpen, messages.length, userProfile]);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!input.trim()) return;

        const userMessage: Message = { role: 'user', content: [{ text: input }] };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await runChat([...messages, userMessage], input);
            const modelMessage: Message = { role: 'model', content: [{ text: response }] };
            setMessages(prev => [...prev, modelMessage]);
        } catch (error) {
            console.error("Chatbot error:", error);
            const errorMessage: Message = { role: 'model', content: [{ text: "Sorry, I'm having a little trouble right now. Please try again later." }] };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <Button
                ref={fabRef}
                className="fixed z-50 h-14 w-14 rounded-full shadow-lg flex items-center justify-center cursor-grab animate-pulse-shadow"
                style={{ top: position.y, left: position.x }}
                onMouseDown={handleMouseDown}
                onClick={() => setIsOpen(true)}
            >
                <Bot className="h-7 w-7" />
            </Button>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="sm:max-w-[425px] md:max-w-lg lg:max-w-2xl flex flex-col h-[70vh]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Bot />
                            AI Learning Assistant
                        </DialogTitle>
                    </DialogHeader>
                    <ScrollArea className="flex-1 p-4 border rounded-md">
                        <div className="space-y-4">
                            {messages.map((msg, index) => (
                                <div key={index} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                                    {msg.role === 'model' && <div className="bg-primary/10 p-2 rounded-full"><Bot className="h-5 w-5 text-primary" /></div>}
                                    <div className={`rounded-lg p-3 max-w-[80%] ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                                        <p className="text-sm whitespace-pre-wrap">{msg.content[0].text}</p>
                                    </div>
                                    {msg.role === 'user' && <div className="bg-muted p-2 rounded-full"><User className="h-5 w-5 text-foreground" /></div>}
                                </div>
                            ))}
                            {isLoading && (
                                <div className="flex items-start gap-3">
                                    <div className="bg-primary/10 p-2 rounded-full"><Bot className="h-5 w-5 text-primary" /></div>
                                    <div className="rounded-lg p-3 bg-muted flex items-center">
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    </div>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                    <DialogFooter>
                        <form onSubmit={handleSubmit} className="flex w-full gap-2">
                            <Input
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Ask me anything about your studies..."
                                disabled={isLoading}
                            />
                            <Button type="submit" disabled={isLoading}>
                                <Send className="h-4 w-4" />
                            </Button>
                        </form>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
