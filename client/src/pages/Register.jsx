import React from 'react';
import { SignUp } from '@clerk/clerk-react';
import SEOHead from '../components/common/SEOHead';

const Register = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
      <SEOHead 
        title="Start Free Interview Prep — Create Your Account" 
        description="Create your free Evalix account. Practice live voice mock interviews with AI interviewer Shristi, take timed technical assessments, and optimize your resume for top engineering roles."
        canonicalUrl="https://interview-ai-ten-psi.vercel.app/register"
        keywords={['sign up Evalix', 'free ai mock interview', 'register coding interview prep', 'technical interview practice account']}
      />
      <SignUp routing="path" path="/register" signInUrl="/login" forceRedirectUrl="/dashboard" />
    </div>
  );
};

export default Register;
