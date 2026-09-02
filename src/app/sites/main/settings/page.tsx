import Navbar from "@main/components/Navbar";
import Footer from "@main/components/Footer";
import SettingsCenter from "@main/components/SettingsCenter";

export default function SettingsPage() {
  return <div className="min-h-screen flex flex-col"><Navbar /><main className="flex-1 flex justify-center px-4 py-10"><SettingsCenter /></main><Footer /></div>;
}
