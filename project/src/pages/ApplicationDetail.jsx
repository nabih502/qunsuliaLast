import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowRight, User, Phone, Mail, MapPin, Calendar, FileText, Download, Star, MessageSquare, Clock, CheckCircle, AlertCircle, Activity, Paperclip, CreditCard as Edit, Save, X, Search, ChevronDown, ZoomIn, Printer, Eye, GraduationCap, QrCode, Shield, Package, ExternalLink, Plus, DollarSign } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { getRegionsList } from '../data/saudiRegions';
import { supabase } from '../lib/supabase';
import { useStatuses } from '../hooks/useStatuses';
import ShippingModal from '../components/ShippingModal';
import EducationalCardModal from '../components/EducationalCardModal';
import EducationalCard from '../components/EducationalCard';
import PriceEditor from '../components/PriceEditor';
import InvoiceModal from '../components/InvoiceModal';
import InvoicePDF from '../components/InvoicePDF';
import { FIELD_LABELS, VALUE_TRANSLATIONS } from '../utils/fieldLabels';
import { evaluateConditions } from '../utils/conditionEvaluator';

const ApplicationDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { statuses: availableStatuses, loading: statusesLoading } = useStatuses();
  const [application, setApplication] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [newActivity, setNewActivity] = useState({ type: '', message: '' });
  const [isAddingActivity, setIsAddingActivity] = useState(false);
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [statusSearchQuery, setStatusSearchQuery] = useState('');
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const statusDropdownRef = useRef(null);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [currentImage, setCurrentImage] = useState(null);
  const [activeTab, setActiveTab] = useState('applicant'); // applicant, service, documents
  const [appointment, setAppointment] = useState(null);
  const [currentStaff, setCurrentStaff] = useState(null);
  const [showShippingModal, setShowShippingModal] = useState(false);
  const [shipment, setShipment] = useState(null);
  const [educationalCard, setEducationalCard] = useState(null);
  const [showEducationalCardModal, setShowEducationalCardModal] = useState(false);
  const [showPriceEditor, setShowPriceEditor] = useState(false);
  const [pricingSummary, setPricingSummary] = useState(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [pricingItems, setPricingItems] = useState([]);
  const [invoice, setInvoice] = useState(null);
  const [showInvoicePDF, setShowInvoicePDF] = useState(false);
  const [serviceFields, setServiceFields] = useState([]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target)) {
        setShowStatusDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close image viewer with ESC key
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape' && showImageViewer) {
        setShowImageViewer(false);
        setCurrentImage(null);
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => document.removeEventListener('keydown', handleEscKey);
  }, [showImageViewer]);

  // Fetch current staff info
  useEffect(() => {
    const fetchCurrentStaff = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: staffData } = await supabase
          .from('staff')
          .select('id, full_name_ar, full_name_en, email')
          .eq('user_id', user.id)
          .maybeSingle();

        if (staffData) {
          setCurrentStaff(staffData);
        }
      }
    };

    fetchCurrentStaff();
  }, []);

  // Fetch application data from database
  useEffect(() => {
    const fetchApplication = async () => {
      try {
        setIsLoading(true);

        const { data, error } = await supabase
          .from('applications')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (error) throw error;

        if (!data) {
          setApplication(null);
          setIsLoading(false);
          return;
        }

        // Transform database data to match component structure
        const transformedApplication = {
          id: data.reference_number || data.id,
          actualId: data.id,
          referenceNumber: data.reference_number,
          serviceId: data.service_id,
          serviceType: data.service_id,
          serviceName: data.service_title,
          serviceCategory: data.service_id,
          status: data.status,
          submissionDate: new Date(data.submission_date).toLocaleDateString('ar-SA'),
          lastUpdate: new Date(data.updated_at).toLocaleDateString('ar-SA'),
          estimatedCompletion: data.estimated_completion ? new Date(data.estimated_completion).toLocaleDateString('ar-SA') : 'غير محدد',
          priority: 'normal',
          fees: {
            base: 300,
            currency: 'ريال سعودي'
          },
          formData: data.form_data || {},
          documents: extractDocumentsFromFormData(data.form_data),
          activities: []
        };

        // Fetch status history (activities)
        const { data: statusHistory, error: historyError } = await supabase
          .from('status_history')
          .select(`
            *,
            staff:staff_id(full_name_ar, full_name_en, email)
          `)
          .eq('application_id', data.id)
          .order('changed_at', { ascending: false });

        const activities = [];

        if (!historyError && statusHistory) {
          const statusActivities = statusHistory.map(history => ({
            id: history.id,
            type: 'status_change',
            title: `تغيير الحالة إلى: ${history.new_status_label}`,
            description: history.notes || `تم تحويل الطلب من "${history.old_status_label}" إلى "${history.new_status_label}"`,
            user: history.staff?.full_name_ar || history.staff?.full_name_en || history.changed_by || 'النظام',
            userEmail: history.staff?.email || '',
            timestamp: new Date(history.changed_at).toLocaleString('ar-SA', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            }),
            rawDate: new Date(history.changed_at),
            status: 'completed'
          }));
          activities.push(...statusActivities);
        }

        // Fetch application notes
        const { data: notesData, error: notesError } = await supabase
          .from('application_notes')
          .select('*')
          .eq('application_id', data.id)
          .order('created_at', { ascending: false });

        if (!notesError && notesData) {
          const noteActivities = notesData.map(note => ({
            id: note.id,
            type: note.note_type,
            title: note.title,
            description: note.content || '',
            user: note.created_by_staff_name,
            userEmail: note.created_by_staff_email || '',
            timestamp: new Date(note.created_at).toLocaleString('ar-SA', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            }),
            rawDate: new Date(note.created_at),
            status: 'completed'
          }));
          activities.push(...noteActivities);
        }

        // Fetch appointment information
        const { data: appointmentData, error: appointmentError } = await supabase
          .from('appointments')
          .select('*')
          .eq('application_id', data.id)
          .in('status', ['confirmed', 'pending'])
          .order('created_at', { ascending: false })
          .maybeSingle();

        if (!appointmentError && appointmentData) {
          setAppointment(appointmentData);

          // Add appointment booking activity
          activities.push({
            id: `appointment-${appointmentData.id}`,
            type: 'appointment',
            title: 'تم حجز موعد',
            description: `تم حجز موعد في ${getFullGregorianDate(appointmentData.appointment_date)} - ${appointmentData.appointment_time}`,
            user: data.form_data?.fullName || 'المتقدم',
            timestamp: new Date(appointmentData.created_at).toLocaleString('ar-SA', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            }),
            rawDate: new Date(appointmentData.created_at),
            status: 'completed'
          });
        }

        // Fetch shipment information
        const { data: shipmentData, error: shipmentError } = await supabase
          .from('shipments')
          .select(`
            *,
            shipping_company:shipping_companies(name, name_en, tracking_url)
          `)
          .eq('application_id', data.id)
          .maybeSingle();

        if (!shipmentError && shipmentData) {
          setShipment(shipmentData);
        }

        // Add submission activity
        activities.push({
          id: 'submission',
          type: 'submission',
          title: 'تم تقديم الطلب',
          description: 'تم تقديم الطلب بنجاح ويتم مراجعته حالياً',
          user: data.form_data?.fullName || 'المتقدم',
          timestamp: new Date(data.submission_date).toLocaleString('ar-SA', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }),
          rawDate: new Date(data.submission_date),
          status: 'completed'
        });

        // Sort all activities by date (most recent first) and assign to application
        activities.sort((a, b) => b.rawDate - a.rawDate);
        transformedApplication.activities = activities;

        setApplication(transformedApplication);
        setNewStatus(transformedApplication.status);

        // Fetch service fields for labels
        const { data: serviceData, error: serviceError } = await supabase
          .from('services')
          .select('id')
          .eq('slug', data.service_id)
          .maybeSingle();

        if (!serviceError && serviceData) {
          const { data: fieldsData, error: fieldsError } = await supabase
            .from('service_fields')
            .select('field_name, label_ar, field_type, options, order_index, conditions, placeholder_ar, validation_rules')
            .eq('service_id', serviceData.id)
            .order('order_index', { ascending: true });

          if (!fieldsError && fieldsData) {
            setServiceFields(fieldsData);
          }
        }

        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching application:', error);
        setApplication(null);
        setIsLoading(false);
      }
    };

    if (id) {
      fetchApplication();
    }
  }, [id]);

  // Fetch pricing summary and items
  useEffect(() => {
    const fetchPricingData = async () => {
      if (!application) return;

      try {
        const { data: summaryData, error: summaryError } = await supabase
          .from('application_pricing_summary')
          .select('*')
          .eq('application_id', application.actualId || id)
          .maybeSingle();

        if (!summaryError && summaryData) {
          setPricingSummary(summaryData);
        }

        const { data: itemsData, error: itemsError } = await supabase
          .from('application_pricing_items')
          .select('*')
          .eq('application_id', application.actualId || id)
          .order('order_index');

        if (!itemsError && itemsData) {
          setPricingItems(itemsData);
        }
      } catch (error) {
        console.error('Error fetching pricing data:', error);
      }
    };

    fetchPricingData();
  }, [application, id]);

  // Fetch invoice if exists
  useEffect(() => {
    const fetchInvoice = async () => {
      if (!application) return;

      try {
        const { data, error } = await supabase
          .from('invoices')
          .select('*')
          .eq('application_id', application.actualId || id)
          .maybeSingle();

        if (!error && data) {
          setInvoice(data);
        }
      } catch (error) {
        console.error('Error fetching invoice:', error);
      }
    };

    fetchInvoice();
  }, [application, id]);

  // Fetch educational card if exists
  useEffect(() => {
    const fetchEducationalCard = async () => {
      if (!application) return;

      try {
        const { data, error } = await supabase
          .from('educational_cards')
          .select('*')
          .eq('application_id', application.actualId || id)
          .maybeSingle();

        if (!error && data) {
          setEducationalCard(data);
        }
      } catch (error) {
        console.error('Error fetching educational card:', error);
      }
    };

    fetchEducationalCard();
  }, [application, id]);

  const handlePricingSaved = async () => {
    try {
      const { data: summaryData, error: summaryError } = await supabase
        .from('application_pricing_summary')
        .select('*')
        .eq('application_id', application.actualId || id)
        .maybeSingle();

      if (!summaryError && summaryData) {
        setPricingSummary(summaryData);
      }

      const { data: itemsData, error: itemsError } = await supabase
        .from('application_pricing_items')
        .select('*')
        .eq('application_id', application.actualId || id)
        .order('order_index');

      if (!itemsError && itemsData) {
        setPricingItems(itemsData);
      }
    } catch (error) {
      console.error('Error refreshing pricing data:', error);
    }
  };

  const handleInvoiceCreated = async (newInvoice) => {
    setInvoice(newInvoice);
    setShowInvoiceModal(false);

    // Update status to payment_completed if needed
    if (newStatus === 'payment_completed' && application.status !== 'payment_completed') {
      await updateApplicationStatus('payment_completed');
    }

    setShowInvoicePDF(true);
    setIsEditingStatus(false);
  };

  // Helper function to extract documents from form data
  const extractDocumentsFromFormData = (formData) => {
    if (!formData) return [];

    const documents = [];
    const documentFields = [
      { key: 'personalPhoto', label: 'الصورة الشخصية' },
      { key: 'nationalIdCopy', label: 'صورة الهوية الوطنية' },
      { key: 'nationalIdCopyAdult', label: 'صورة الهوية (ولي الأمر)' },
      { key: 'passportCopy', label: 'صورة الجواز' },
      { key: 'residencyCopy', label: 'صورة الإقامة' },
      { key: 'birthCertificate', label: 'شهادة الميلاد' },
      { key: 'marriageCertificate', label: 'عقد الزواج' },
      { key: 'deathCertificate', label: 'شهادة الوفاة' },
      { key: 'document1', label: 'مستند 1' },
      { key: 'document2', label: 'مستند 2' },
      { key: 'document3', label: 'مستند 3' },
      { key: 'policeReport', label: 'محضر الشرطة' },
      { key: 'oldPassportPhoto', label: 'صورة الجواز القديم' },
      { key: 'additionalDocuments', label: 'مستندات إضافية' }
    ];

    documentFields.forEach(field => {
      const fieldData = formData[field.key];

      if (fieldData && Array.isArray(fieldData)) {
        fieldData.forEach((doc, index) => {
          // Check if doc has actual file data
          if (doc && (doc.name || doc.url || doc.preview)) {
            documents.push({
              name: doc.name || `${field.label}${fieldData.length > 1 ? ` ${index + 1}` : ''}`,
              size: doc.size || 'غير محدد',
              uploadDate: doc.uploadDate || new Date().toLocaleDateString('ar-SA'),
              type: doc.type || getFileType(doc.name),
              url: doc.url || doc.preview || '',
              label: field.label
            });
          }
        });
      }
    });

    // استخراج المستندات الديناميكية (document_xxx)
    Object.entries(formData).forEach(([key, fieldData]) => {
      // تخطي مفاتيح الـ labels لأنها ليست مستندات فعلية
      if (key.startsWith('document_') && !key.endsWith('_label')) {
        const label = formData[`${key}_label`] || 'مستند';

        if (fieldData && Array.isArray(fieldData)) {
          fieldData.forEach((doc, index) => {
            if (doc && (doc.name || doc.url || doc.preview)) {
              documents.push({
                name: `${label}${fieldData.length > 1 ? ` (${index + 1})` : ''}`,
                originalFileName: doc.name || 'ملف',
                size: doc.size || 'غير محدد',
                uploadDate: doc.uploadDate || new Date().toLocaleDateString('ar-SA'),
                type: doc.type || getFileType(doc.name),
                url: doc.url || doc.preview || '',
                label: label
              });
            }
          });
        } else if (fieldData && typeof fieldData === 'string') {
          // إذا كان المستند string (URL مباشر)
          documents.push({
            name: label,
            size: 'غير محدد',
            uploadDate: new Date().toLocaleDateString('ar-SA'),
            type: getFileType(fieldData),
            url: fieldData,
            label: label
          });
        }
      }
    });

    return documents;
  };

  const getFileType = (filename) => {
    if (!filename) return 'file';
    const ext = filename.split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) return 'image';
    if (ext === 'pdf') return 'pdf';
    return 'file';
  };

  const getStatusInfo = (status) => {
    if (!availableStatuses || availableStatuses.length === 0) {
      return {
        status_key: status,
        label_ar: status,
        color_class: 'bg-gray-100 text-gray-800',
        icon: AlertCircle
      };
    }

    const statusInfo = availableStatuses.find(s => s.status_key === status);
    if (!statusInfo) {
      return {
        status_key: status,
        label_ar: status,
        color_class: 'bg-gray-100 text-gray-800',
        icon: AlertCircle
      };
    }

    return {
      ...statusInfo,
      label: statusInfo.label_ar,
      color: statusInfo.color_class,
      icon: getIconForStatus(statusInfo.icon_name)
    };
  };

  const getIconForStatus = (iconName) => {
    const iconMap = {
      'CheckCircle': CheckCircle,
      'Clock': Clock,
      'AlertCircle': AlertCircle,
      'Calendar': Calendar,
      'Activity': Activity,
      'X': X
    };
    return iconMap[iconName] || AlertCircle;
  };

  const getRegionLabel = (regionId) => {
    const region = getRegionsList().find(r => r.value === regionId);
    return region ? region.label : regionId;
  };

  const getFilteredStatuses = () => {
    if (!availableStatuses || availableStatuses.length === 0) {
      return [];
    }
    if (!statusSearchQuery.trim()) {
      return availableStatuses;
    }
    return availableStatuses.filter(status =>
      status.label_ar.toLowerCase().includes(statusSearchQuery.toLowerCase())
    );
  };

  const handleStatusSelect = (statusId) => {
    setNewStatus(statusId);
    setShowStatusDropdown(false);
    setStatusSearchQuery('');
  };

  const isImageFile = (filename) => {
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
    const extension = filename.split('.').pop().toLowerCase();
    return imageExtensions.includes(extension);
  };

  const generateQRCode = (refNumber) => {
    const qrData = `${window.location.origin}/verify/${refNumber}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(qrData)}`;
  };

  const isEducationService = () => {
    if (!application) return false;

    // Check serviceType first
    if (application.serviceType === 'education') return true;

    // Check service_id for known education services
    const educationServiceIds = ['primary', 'intermediate', 'secondary', 'primary-education', 'intermediate-education', 'secondary-education'];
    if (application.serviceId && educationServiceIds.includes(application.serviceId.toLowerCase())) {
      return true;
    }

    // Check serviceCategory
    if (application.serviceCategory) {
      const educationKeywords = ['education', 'تعليم', 'exam', 'امتحان', 'certificate', 'شهادة'];
      if (educationKeywords.some(keyword =>
        application.serviceCategory.toLowerCase().includes(keyword.toLowerCase())
      )) {
        return true;
      }
    }

    // Check serviceName/serviceTitle
    if (application.serviceName) {
      const educationKeywords = ['education', 'تعليم', 'exam', 'امتحان', 'certificate', 'شهادة', 'ابتدائية', 'إعدادية', 'ثانوية'];
      if (educationKeywords.some(keyword =>
        application.serviceName.toLowerCase().includes(keyword.toLowerCase())
      )) {
        return true;
      }
    }

    return false;
  };

  const hasExamCard = () => {
    return isEducationService() &&
           application?.status &&
           ['approved', 'completed', 'ready_for_pickup'].includes(application.status);
  };

  const handleEducationalCardSave = async () => {
    const { data, error } = await supabase
      .from('educational_cards')
      .select('*')
      .eq('application_id', application.actualId || id)
      .maybeSingle();

    if (!error && data) {
      setEducationalCard(data);
    }
  };

  const handlePrintCard = () => {
    window.print();
  };

  const handleDownloadCard = async () => {
    const cardElement = document.getElementById('educational-card-print');
    if (!cardElement) return;

    try {
      // Capture the card as an image with higher quality
      const canvas = await html2canvas(cardElement, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      // Calculate dimensions for PDF (A4 landscape)
      const imgWidth = 297; // A4 landscape width in mm
      const imgHeight = 210; // A4 landscape height in mm

      // Create PDF
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      // Add image to PDF
      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);

      // Download the PDF
      const fileName = `educational-card-${educationalCard?.card_number || 'unknown'}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('حدث خطأ أثناء تحميل البطاقة. الرجاء المحاولة مرة أخرى.');
    }
  };

  const handleViewImage = (doc) => {
    setCurrentImage(doc);
    setShowImageViewer(true);
  };

  const handlePrintImage = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>طباعة - ${currentImage.name}</title>
          <style>
            body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
            img { max-width: 100%; max-height: 100vh; }
            @media print {
              body { margin: 0; }
              img { max-width: 100%; height: auto; }
            }
          </style>
        </head>
        <body>
          <img src="${currentImage.url}" alt="${currentImage.name}" onload="window.print(); window.close();" />
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDownloadImage = () => {
    const link = document.createElement('a');
    link.href = currentImage.url;
    link.download = currentImage.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleStatusUpdate = () => {
    if (newStatus === application.status) {
      setIsEditingStatus(false);
      return;
    }

    // If rejected or cancelled, show rejection modal
    if (newStatus === 'rejected' || newStatus === 'cancelled') {
      setShowRejectionModal(true);
      return;
    }

    // If shipping or shipped, show shipping modal
    if (newStatus === 'shipping' || newStatus === 'shipped') {
      setShowShippingModal(true);
      return;
    }

    // If payment completed, show invoice modal
    if (newStatus === 'payment_completed' && !invoice) {
      if (!pricingSummary) {
        alert('يرجى إضافة تفاصيل السعر أولاً قبل إصدار الفاتورة');
        return;
      }
      setShowInvoiceModal(true);
      return;
    }

    // Update status directly for all other statuses
    // Note: For appointment_required status, the citizen will book the appointment themselves
    updateApplicationStatus(newStatus);
  };

  const updateApplicationStatus = async (status, additionalData = {}) => {
    try {
      // Get old status before update
      const oldStatus = application.status;
      const statusInfo = getStatusInfo(status);

      // Update application status in database
      const { error: updateError } = await supabase
        .from('applications')
        .update({
          status: status,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (updateError) throw updateError;

      // Manually insert into status_history with staff info
      const { error: historyError } = await supabase
        .from('status_history')
        .insert({
          application_id: id,
          old_status: oldStatus,
          new_status: status,
          old_status_label: getStatusInfo(oldStatus)?.label || oldStatus,
          new_status_label: statusInfo?.label || status,
          staff_id: currentStaff?.id || null,
          changed_by: currentStaff?.full_name_ar || currentStaff?.full_name_en || 'النظام',
          notes: additionalData.reason || 'تم تحديث حالة الطلب'
        });

      if (historyError) {
        console.error('Error logging status change:', historyError);
      }

      const newActivityEntry = {
        id: application.activities.length + 1,
        type: 'status_change',
        title: `تم تغيير الحالة إلى: ${statusInfo.label}`,
        description: additionalData.reason || 'تم تحديث حالة الطلب',
        user: currentStaff?.full_name_ar || currentStaff?.full_name_en || 'الموظف الحالي',
        userEmail: currentStaff?.email || '',
        timestamp: new Date().toLocaleString('ar-SA', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        status: status
      };

      const updatedApplication = {
        ...application,
        status: status,
        lastUpdate: new Date().toLocaleDateString('ar-SA'),
        activities: [newActivityEntry, ...application.activities]
      };

      // Add appointment data if provided
      if (additionalData.appointmentDate) {
        updatedApplication.appointmentDate = additionalData.appointmentDate;
        updatedApplication.appointmentTime = additionalData.appointmentTime;
      }

      setApplication(updatedApplication);
      setIsEditingStatus(false);
    } catch (error) {
      console.error('Error updating application status:', error);
      alert('حدث خطأ في تحديث حالة الطلب');
    }
  };

  const handleRejectionSubmit = () => {
    if (!rejectionReason.trim()) {
      alert('يرجى إدخال سبب الرفض أو الإلغاء');
      return;
    }

    if (rejectionReason.trim().length < 20) {
      alert('يرجى كتابة سبب تفصيلي لا يقل عن 20 حرف');
      return;
    }

    updateApplicationStatus(newStatus, { reason: rejectionReason });
    setShowRejectionModal(false);
    setRejectionReason('');
    setIsEditingStatus(false);
  };

  const handleShippingSubmit = async (shippingData) => {
    await updateApplicationStatus(newStatus, { shippingData });

    // Reload shipment data
    const { data: shipmentData } = await supabase
      .from('shipments')
      .select(`
        *,
        shipping_company:shipping_companies(name, name_en, tracking_url)
      `)
      .eq('application_id', id)
      .maybeSingle();

    if (shipmentData) {
      setShipment(shipmentData);
    }

    setShowShippingModal(false);
    setIsEditingStatus(false);
  };


  const handleAddActivity = async () => {
    if (newActivity.type && newActivity.message && currentStaff) {
      try {
        // حفظ الملاحظة في قاعدة البيانات
        const { data: noteData, error } = await supabase
          .from('application_notes')
          .insert([
            {
              application_id: application.actualId,
              note_type: newActivity.type,
              title: newActivity.message,
              content: '',
              created_by_staff_id: currentStaff.id,
              created_by_staff_name: currentStaff.full_name_ar || currentStaff.full_name_en,
              created_by_staff_email: currentStaff.email,
              is_visible_to_user: true
            }
          ])
          .select()
          .single();

        if (error) {
          console.error('Error adding note:', error);
          alert('حدث خطأ في حفظ الملاحظة');
          return;
        }

        // إضافة الملاحظة للعرض في الواجهة
        const activityEntry = {
          id: noteData.id,
          type: newActivity.type,
          title: newActivity.message,
          description: '',
          user: currentStaff.full_name_ar || currentStaff.full_name_en,
          userEmail: currentStaff.email,
          timestamp: new Date().toLocaleString('ar-SA', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }),
          rawDate: new Date(),
          status: 'completed'
        };

        setApplication({
          ...application,
          activities: [activityEntry, ...application.activities]
        });

        setNewActivity({ type: '', message: '' });
        setIsAddingActivity(false);
      } catch (error) {
        console.error('Error adding activity:', error);
        alert('حدث خطأ في حفظ النشاط');
      }
    } else if (!currentStaff) {
      alert('لا يمكن إضافة ملاحظة. معلومات الموظف غير متوفرة');
    }
  };

  const renderStars = (rating) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-5 h-5 ${i < rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
      />
    ));
  };

  const getFullHijriDate = (date) => {
    try {
      const formatter = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        calendar: 'islamic-umalqura',
        numberingSystem: 'latn'
      });
      return formatter.format(new Date(date));
    } catch (error) {
      return '';
    }
  };

  const getFullGregorianDate = (date) => {
    try {
      const formatter = new Intl.DateTimeFormat('ar', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
      return formatter.format(new Date(date));
    } catch (error) {
      return new Date(date).toLocaleDateString('ar');
    }
  };

  const regionNames = {
    riyadh: 'الرياض',
    jeddah: 'جدة',
    dammam: 'الدمام',
    makkah: 'مكة المكرمة',
    madinah: 'المدينة المنورة'
  };

  const getActivityIcon = (type) => {
    switch (type) {
      case 'status_change': return CheckCircle;
      case 'document_upload': return Paperclip;
      case 'submission': return FileText;
      case 'appointment': return Calendar;
      case 'note': return MessageSquare;
      case 'comment': return MessageSquare;
      case 'call': return Phone;
      case 'email': return Mail;
      default: return Activity;
    }
  };

  const getActivityTypeLabel = (type) => {
    switch (type) {
      case 'status_change': return 'تغيير الحالة';
      case 'document_upload': return 'رفع مستند';
      case 'submission': return 'تقديم الطلب';
      case 'appointment': return 'موعد';
      case 'note': return 'ملاحظة';
      case 'comment': return 'تعليق';
      case 'internal_note': return 'ملاحظة داخلية';
      case 'system_note': return 'ملاحظة النظام';
      case 'call': return 'مكالمة هاتفية';
      case 'email': return 'بريد إلكتروني';
      default: return 'نشاط';
    }
  };

  const getActivityTypeBadgeColor = (type) => {
    switch (type) {
      case 'status_change': return 'bg-blue-100 text-blue-800';
      case 'document_upload': return 'bg-purple-100 text-purple-800';
      case 'submission': return 'bg-green-100 text-green-800';
      case 'appointment': return 'bg-orange-100 text-orange-800';
      case 'note': return 'bg-yellow-100 text-yellow-800';
      case 'comment': return 'bg-cyan-100 text-cyan-800';
      case 'internal_note': return 'bg-gray-100 text-gray-800';
      case 'system_note': return 'bg-indigo-100 text-indigo-800';
      case 'call': return 'bg-pink-100 text-pink-800';
      case 'email': return 'bg-teal-100 text-teal-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#276073] mx-auto"></div>
          <p className="mt-4 text-gray-600">جاري تحميل التفاصيل...</p>
        </div>
      </div>
    );
  }

  if (!application) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">لم يتم العثور على الطلب</h2>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 px-6 py-2 bg-[#276073] text-white rounded-lg hover:bg-[#1e4a5a]"
          >
            العودة
          </button>
        </div>
      </div>
    );
  }

  const statusInfo = getStatusInfo(application.status);
  const StatusIcon = statusInfo.icon;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center text-[#276073] hover:text-[#1e4a5a] mb-4"
          >
            <ArrowRight className="w-5 h-5 ml-2" />
            <span>العودة</span>
          </button>

          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  {application.serviceName}
                </h1>
                <p className="text-lg text-gray-600">رقم المعاملة: <span className="font-mono font-semibold text-[#276073]">{application.id}</span></p>
              </div>

              <div className="flex items-center gap-2">
                {isEditingStatus ? (
                  <div className="flex items-center gap-2">
                    <div className="relative" ref={statusDropdownRef}>
                      <button
                        onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                        className="min-w-[200px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#276073] focus:border-transparent outline-none bg-white text-right flex items-center justify-between"
                      >
                        <span>{getStatusInfo(newStatus).label}</span>
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      </button>

                      {showStatusDropdown && (
                        <div className="absolute left-0 mt-2 w-[280px] bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-[400px] overflow-hidden">
                          <div className="p-2 border-b border-gray-200">
                            <div className="relative">
                              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                              <input
                                type="text"
                                value={statusSearchQuery}
                                onChange={(e) => setStatusSearchQuery(e.target.value)}
                                placeholder="ابحث عن حالة..."
                                className="w-full pr-10 pl-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#276073] focus:border-transparent outline-none text-sm"
                                autoFocus
                              />
                            </div>
                          </div>

                          <div className="max-h-[320px] overflow-y-auto">
                            {getFilteredStatuses().length > 0 ? (
                              getFilteredStatuses().map(status => {
                                const StatusIcon = getIconForStatus(status.icon_name);
                                return (
                                  <button
                                    key={status.status_key}
                                    onClick={() => handleStatusSelect(status.status_key)}
                                    className={`w-full px-4 py-2.5 text-right hover:bg-gray-50 flex items-center gap-3 transition-colors ${
                                      newStatus === status.status_key ? 'bg-blue-50' : ''
                                    }`}
                                  >
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${status.color_class}`}>
                                      <StatusIcon className="w-4 h-4" />
                                    </div>
                                    <span className="font-medium text-gray-900">{status.label_ar}</span>
                                    {newStatus === status.status_key && (
                                      <CheckCircle className="w-4 h-4 text-green-600 mr-auto" />
                                    )}
                                  </button>
                                );
                              })
                            ) : (
                              <div className="px-4 py-8 text-center text-gray-500">
                                <Search className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                                <p>لا توجد نتائج</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={handleStatusUpdate}
                      className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      <Save className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setIsEditingStatus(false);
                        setNewStatus(application.status);
                        setShowStatusDropdown(false);
                        setStatusSearchQuery('');
                      }}
                      className="p-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className={`px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 ${statusInfo.color}`}>
                      <StatusIcon className="w-4 h-4" />
                      {statusInfo.label}
                    </span>
                    <button
                      onClick={() => setIsEditingStatus(true)}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                      title="تعديل الحالة"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    {!invoice && (
                      <button
                        onClick={() => setShowPriceEditor(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        title="تعديل قيمة الدفع"
                      >
                        <DollarSign className="w-4 h-4" />
                        <span>تعديل السعر</span>
                      </button>
                    )}
                    {invoice && (
                      <button
                        onClick={() => setShowInvoicePDF(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        title="عرض الفاتورة"
                      >
                        <FileText className="w-4 h-4" />
                        <span>عرض الفاتورة</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-200">
              <div>
                <p className="text-sm text-gray-600 mb-1">تاريخ التقديم</p>
                <p className="font-semibold text-gray-900">{application.submissionDate}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">آخر تحديث</p>
                <p className="font-semibold text-gray-900">{application.lastUpdate}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">الإنجاز المتوقع</p>
                <p className="font-semibold text-gray-900">{application.estimatedCompletion}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">الرسوم</p>
                <p className="font-semibold text-[#276073]">
                  {pricingSummary ? `${parseFloat(pricingSummary.total_amount).toFixed(2)} ريال` : `${application.fees.base} ${application.fees.currency}`}
                </p>
              </div>
            </div>

            {/* Pricing Details */}
            {pricingSummary && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="flex items-center gap-2 mb-4">
                  <DollarSign className="w-5 h-5 text-blue-600" />
                  <h3 className="text-lg font-bold text-gray-900">تفاصيل السعر</h3>
                  {!pricingSummary.is_editable && (
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                      تم الدفع
                    </span>
                  )}
                </div>

                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700">المجموع الفرعي:</span>
                    <span className="font-semibold">{parseFloat(pricingSummary.subtotal).toFixed(2)} ريال</span>
                  </div>
                  {parseFloat(pricingSummary.discount) > 0 && (
                    <div className="flex justify-between text-sm text-red-600">
                      <span>الخصم:</span>
                      <span>- {parseFloat(pricingSummary.discount).toFixed(2)} ريال</span>
                    </div>
                  )}
                  {parseFloat(pricingSummary.tax) > 0 && (
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>الضريبة:</span>
                      <span>+ {parseFloat(pricingSummary.tax).toFixed(2)} ريال</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold text-blue-600 pt-3 border-t border-blue-200">
                    <span>المبلغ الإجمالي:</span>
                    <span>{parseFloat(pricingSummary.total_amount).toFixed(2)} ريال</span>
                  </div>
                  {pricingSummary.notes && (
                    <div className="pt-3 border-t border-blue-200">
                      <p className="text-sm text-gray-600 mb-1">ملاحظات:</p>
                      <p className="text-sm text-gray-800">{pricingSummary.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Appointment Information */}
            {appointment && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="w-5 h-5 text-green-600" />
                  <h3 className="text-lg font-bold text-gray-900">معلومات الموعد</h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    appointment.status === 'confirmed'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {appointment.status === 'confirmed' ? 'مؤكد' : 'قيد الانتظار'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-green-50 rounded-lg p-4 border border-green-200">
                  <div>
                    <p className="text-sm text-gray-600 mb-1 flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      التاريخ الميلادي
                    </p>
                    <p className="font-bold text-gray-900">{getFullGregorianDate(appointment.appointment_date)}</p>
                    <p className="text-sm text-gray-600 mt-2">التاريخ الهجري</p>
                    <p className="font-semibold text-gray-800">{getFullHijriDate(appointment.appointment_date)} هـ</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1 flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      الوقت
                    </p>
                    <p className="font-bold text-gray-900">{appointment.appointment_time}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1 flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      الموقع
                    </p>
                    <p className="font-bold text-gray-900">
                      القنصلية - {regionNames[appointment.region] || appointment.region}
                    </p>
                  </div>
                </div>

                {appointment.notes && (
                  <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-blue-800 mb-1">ملاحظات الموعد</p>
                    <p className="text-sm text-blue-900">{appointment.notes}</p>
                  </div>
                )}
              </div>
            )}

            {/* Shipment Information */}
            {shipment && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="flex items-center gap-2 mb-4">
                  <Package className="w-5 h-5 text-blue-600" />
                  <h3 className="text-lg font-bold text-gray-900">معلومات الشحن</h3>
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                    {shipment.current_status === 'in_transit' ? 'قيد الشحن' : shipment.current_status}
                  </span>
                </div>

                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600 mb-1 flex items-center gap-1">
                        <Package className="w-4 h-4" />
                        شركة الشحن
                      </p>
                      <p className="font-bold text-gray-900">{shipment.shipping_company?.name || shipment.carrier}</p>
                    </div>

                    <div>
                      <p className="text-sm text-gray-600 mb-1 flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        تاريخ الشحن
                      </p>
                      <p className="font-bold text-gray-900">
                        {shipment.shipped_at ? new Date(shipment.shipped_at).toLocaleDateString('ar-SA') : 'غير محدد'}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-gray-600 mb-1 flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        تاريخ الوصول المتوقع
                      </p>
                      <p className="font-bold text-gray-900">
                        {shipment.estimated_delivery ? new Date(shipment.estimated_delivery).toLocaleDateString('ar-SA') : 'غير محدد'}
                      </p>
                    </div>

                    {shipment.tracking_url && (
                      <div>
                        <p className="text-sm text-gray-600 mb-1">رابط التتبع</p>
                        <a
                          href={shipment.tracking_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-semibold"
                        >
                          <span>تتبع الشحنة</span>
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Tabs Navigation */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100">
              <div className="flex border-b border-gray-200">
                <button
                  onClick={() => setActiveTab('applicant')}
                  className={`flex-1 px-6 py-4 text-center font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
                    activeTab === 'applicant'
                      ? 'text-[#276073] border-b-2 border-[#276073] bg-blue-50/50'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <User className="w-5 h-5" />
                  <span>بيانات المتقدم</span>
                </button>
                <button
                  onClick={() => setActiveTab('service')}
                  className={`flex-1 px-6 py-4 text-center font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
                    activeTab === 'service'
                      ? 'text-[#276073] border-b-2 border-[#276073] bg-blue-50/50'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <FileText className="w-5 h-5" />
                  <span>تفاصيل الطلب</span>
                </button>
                <button
                  onClick={() => setActiveTab('documents')}
                  className={`flex-1 px-6 py-4 text-center font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
                    activeTab === 'documents'
                      ? 'text-[#276073] border-b-2 border-[#276073] bg-blue-50/50'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Paperclip className="w-5 h-5" />
                  <span>المستندات</span>
                </button>
              </div>

              {/* Tab Content */}
              <div className="p-6">
                {/* Applicant Information Tab */}
                {activeTab === 'applicant' && (
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <User className="w-5 h-5 text-[#276073]" />
                      بيانات المتقدم
                    </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {application.formData && (() => {
                  // تحديد الحقول الشخصية فقط
                  const personalFields = [
                    'fullName', 'nationalId', 'phoneNumber', 'email',
                    'dob', 'dateOfBirth', 'birthDate',
                    'region', 'city', 'district', 'address',
                    'profession', 'workplace', 'isAdult', 'gender',
                    'nationality', 'maritalStatus', 'idNumber',
                    'passportNumber', 'iqamaNumber'
                  ];

                  const fieldLabels = {
                    fullName: 'الاسم الكامل',
                    nationalId: 'رقم الهوية/الجواز',
                    phoneNumber: 'رقم الهاتف',
                    email: 'البريد الإلكتروني',
                    dob: 'تاريخ الميلاد',
                    dateOfBirth: 'تاريخ الميلاد',
                    birthDate: 'تاريخ الميلاد',
                    region: 'المنطقة',
                    city: 'المدينة',
                    district: 'الحي',
                    address: 'العنوان الكامل',
                    profession: 'المهنة',
                    workplace: 'جهة العمل',
                    isAdult: 'الفئة العمرية',
                    gender: 'الجنس',
                    nationality: 'الجنسية',
                    maritalStatus: 'الحالة الاجتماعية',
                    idNumber: 'رقم الهوية',
                    passportNumber: 'رقم الجواز',
                    iqamaNumber: 'رقم الإقامة',
                  };

                  return Object.entries(application.formData).map(([key, value]) => {
                    // عرض الحقول الشخصية فقط
                    if (!personalFields.includes(key)) return null;

                    // تخطي القيم الفارغة
                    if (!value || typeof value === 'object') return null;

                    const label = fieldLabels[key] || key;

                  // Format value based on field type
                  let displayValue = value;
                  if (key === 'region') {
                    displayValue = getRegionLabel(value);
                  } else if (key === 'isAdult') {
                    displayValue = value === 'yes' ? 'بالغ (18+ سنة)' : 'قاصر (أقل من 18 سنة)';
                  } else if (key === 'gender') {
                    displayValue = value === 'male' ? 'ذكر' : 'أنثى';
                  } else {
                    // ترجمة القيم من options إذا كان الحقل موجود في serviceFields
                    const fieldFromDB = serviceFields.find(f => f.field_name === key);
                    if (fieldFromDB?.options && Array.isArray(fieldFromDB.options) && fieldFromDB.options.length > 0) {
                      const option = fieldFromDB.options.find(opt => opt.value === value);
                      displayValue = option?.label_ar || option?.label || value;
                    }
                  }

                  // Determine icon based on field
                  let IconComponent = FileText;
                  if (key.includes('phone') || key.includes('Phone')) IconComponent = Phone;
                  else if (key.includes('email') || key.includes('Email')) IconComponent = Mail;
                  else if (key.includes('address') || key.includes('region') || key.includes('city') || key.includes('district')) IconComponent = MapPin;
                  else if (key.includes('date') || key.includes('dob') || key.includes('Date')) IconComponent = Calendar;
                  else if (key.includes('name') || key.includes('Name')) IconComponent = User;

                  const isWide = key === 'address' || key === 'notes';

                  return (
                    <div key={key} className={`flex items-start gap-3 ${isWide ? 'md:col-span-2' : ''}`}>
                      <IconComponent className="w-5 h-5 text-gray-400 mt-1 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-600">{label}</p>
                        <p className="font-semibold text-gray-900 break-words">{displayValue}</p>
                      </div>
                    </div>
                  );
                  });
                })()}
              </div>

                    {/* Appointment Information */}
                    {application.appointmentDate && (
                      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-6 border border-blue-200 mt-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  موعد الحجز
                </h2>

                <div className="bg-white rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-blue-100 rounded-xl flex flex-col items-center justify-center">
                        <span className="text-2xl font-bold text-blue-600">{new Date(application.appointmentDate).getDate()}</span>
                        <span className="text-xs text-blue-600">{new Date(application.appointmentDate).toLocaleDateString('ar-SA', { month: 'short' })}</span>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-gray-900">{new Date(application.appointmentDate).toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                        <p className="text-sm text-gray-600 flex items-center gap-2 mt-1">
                          <Clock className="w-4 h-4" />
                          الساعة: {application.appointmentTime}
                        </p>
                      </div>
                    </div>
                    <div className="text-center">
                      <span className="inline-block px-4 py-2 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                        موعد مؤكد
                      </span>
                    </div>
                  </div>
                </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Service Details Tab */}
                {activeTab === 'service' && (
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-[#276073]" />
                      تفاصيل الطلب
                    </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(() => {
                  const personalFields = ['fullName', 'nationalId', 'phoneNumber', 'email', 'dob', 'dateOfBirth',
                                         'region', 'city', 'district', 'address', 'profession', 'workplace',
                                         'gender', 'nationality', 'maritalStatus', 'idNumber',
                                         'passportNumber', 'iqamaNumber', 'documents'];

                  // ترتيب الحقول حسب display_order من قاعدة البيانات
                  console.log('📊 [ApplicationDetail] Service Fields:', {
                    totalFields: serviceFields.length,
                    fields: serviceFields.map(f => ({
                      name: f.field_name,
                      label: f.label_ar,
                      order: f.order_index,
                      hasConditions: !!f.conditions,
                      conditions: f.conditions
                    }))
                  });

                  console.log('📝 [ApplicationDetail] Form Data:', application.formData);

                  const sortedFields = serviceFields
                    .filter(field => {
                      console.log(`\n🔍 [Filtering] Checking field: ${field.field_name}`);

                      // عرض الحقول الخاصة بالخدمة فقط (مش الحقول الشخصية)
                      if (personalFields.includes(field.field_name)) {
                        console.log(`  ⏭️  Skipped (personal field)`);
                        return false;
                      }

                      // تخطي حقول labels
                      if (field.field_name.endsWith('_label')) {
                        console.log(`  ⏭️  Skipped (label field)`);
                        return false;
                      }

                      // التحقق من وجود قيمة للحقل - يظهر فقط الحقول المعبّأة
                      const value = application.formData?.[field.field_name];
                      console.log(`  📌 Value: ${JSON.stringify(value)} (type: ${typeof value})`);

                      // إخفاء الحقول الفاضية (undefined, null, empty string)
                      if (value === undefined || value === null) {
                        console.log(`  ❌ Hidden (undefined/null)`);
                        return false;
                      }
                      if (typeof value === 'string' && value.trim() === '') {
                        console.log(`  ❌ Hidden (empty string)`);
                        return false;
                      }
                      // إخفاء الـ objects (except arrays للحقول المتعددة)
                      if (typeof value === 'object' && !Array.isArray(value)) {
                        console.log(`  ❌ Hidden (object, not array)`);
                        return false;
                      }

                      // تطبيق conditional logic - إخفاء الحقول بناءً على الشروط
                      if (field.conditions) {
                        console.log(`  🎯 Has conditions:`, field.conditions);
                        const isVisible = evaluateConditions(field.conditions, application.formData);
                        console.log(`  ${isVisible ? '✅' : '❌'} Condition result: ${isVisible ? 'VISIBLE' : 'HIDDEN'}`);
                        if (!isVisible) return false;
                      }

                      console.log(`  ✅ PASSED - Will be displayed`);
                      return true;
                    })
                    .sort((a, b) => (a.order_index || 0) - (b.order_index || 0));

                  console.log('✅ [ApplicationDetail] Final filtered and sorted fields:',
                    sortedFields.map(f => ({ name: f.field_name, order: f.order_index }))
                  );

                  return sortedFields.map((field) => {
                    const key = field.field_name;
                    const value = application.formData[key];
                    const label = field.label_ar || FIELD_LABELS[key] || key;

                    // Format value and translate to Arabic
                    let displayValue = value;

                    // إذا كان الحقل له options، نترجم القيمة من options
                    if (field.options && Array.isArray(field.options) && field.options.length > 0) {
                      const option = field.options.find(opt => opt.value === value);
                      displayValue = option?.label_ar || option?.label || value;
                    } else {
                      // استخدام الترجمة من dictionary كـ fallback
                      displayValue = VALUE_TRANSLATIONS[value] || value;
                    }

                    const isWide = key === 'notes' || key === 'declarationContent' || key === 'powerScope' || key === 'specialRequests';

                    return (
                      <div key={key} className={`bg-gray-50 rounded-lg p-3 ${isWide ? 'md:col-span-2' : ''}`}>
                        <p className="text-sm text-gray-600 mb-1">{label}</p>
                        <p className="font-semibold text-gray-900 break-words">{displayValue}</p>
                      </div>
                    );
                  });
                })()}
              </div>

              {application.formData?.notes && (
                <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-yellow-800 mb-1">ملاحظات</p>
                  <p className="text-gray-700">{application.formData.notes}</p>
                </div>
              )}
                  </div>
                )}

                {/* Documents Tab */}
                {activeTab === 'documents' && (
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <Paperclip className="w-5 h-5 text-[#276073]" />
                      المستندات المرفقة ({application.documents.length})
                    </h2>

              {application.documents.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <Paperclip className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">لا توجد مستندات مرفقة</h3>
                  <p className="text-gray-500">لم يتم رفع أي مستندات مع هذا الطلب</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {application.documents.map((doc, index) => {
                  const isImage = isImageFile(doc.name);
                  return (
                    <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="flex items-center gap-3 flex-1">
                        {isImage ? (
                          <div className="relative group">
                            <img
                              src={doc.url}
                              alt={doc.name}
                              className="w-16 h-16 rounded-lg object-cover border-2 border-gray-200 cursor-pointer"
                              onClick={() => handleViewImage(doc)}
                            />
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 rounded-lg transition-all flex items-center justify-center">
                              <Eye className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </div>
                        ) : (
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            doc.type === 'pdf' ? 'bg-red-100' : 'bg-blue-100'
                          }`}>
                            <FileText className={`w-5 h-5 ${
                              doc.type === 'pdf' ? 'text-red-600' : 'text-blue-600'
                            }`} />
                          </div>
                        )}
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900">{doc.name}</p>
                          <p className="text-sm text-gray-600">{doc.size} • {doc.uploadDate}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isImage && (
                          <button
                            onClick={() => handleViewImage(doc)}
                            className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                            title="معاينة"
                          >
                            <Eye className="w-5 h-5" />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = doc.url;
                            link.download = doc.name;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }}
                          className="p-2 text-[#276073] hover:bg-[#276073] hover:text-white rounded-lg transition-colors"
                          title="تحميل"
                        >
                          <Download className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              )}
                  </div>
                )}
              </div>
            </div>

            {/* Customer Feedback */}
            {application.customerFeedback && (
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl shadow-lg p-6 border border-amber-200">
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Star className="w-5 h-5 text-amber-500" />
                  تقييم العميل
                </h2>

                <div className="bg-white rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    {renderStars(application.customerFeedback.rating)}
                    <span className="text-lg font-bold text-gray-900 mr-2">{application.customerFeedback.rating}/5</span>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-start gap-2 mb-2">
                      <MessageSquare className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
                      <p className="text-gray-700 leading-relaxed">{application.customerFeedback.comment}</p>
                    </div>
                    <p className="text-sm text-gray-500 text-left mt-2">
                      {application.customerFeedback.submittedDate}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Educational Card Section */}
            {isEducationService() && (
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-teal-600 to-teal-800 p-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                      <GraduationCap className="w-7 h-7" />
                      البطاقة التعليمية
                    </h2>
                    {!educationalCard && (
                      <button
                        onClick={() => setShowEducationalCardModal(true)}
                        className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg font-semibold transition-colors duration-200 flex items-center gap-2"
                      >
                        <Plus className="w-5 h-5" />
                        إنشاء بطاقة
                      </button>
                    )}
                    {educationalCard && (
                      <button
                        onClick={() => setShowEducationalCardModal(true)}
                        className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg font-semibold transition-colors duration-200 flex items-center gap-2"
                      >
                        <Edit className="w-5 h-5" />
                        تعديل البطاقة
                      </button>
                    )}
                  </div>
                  {educationalCard ? (
                    <p className="text-white/90 text-sm mt-2">
                      تم إنشاء البطاقة التعليمية للطالب - يمكنك المعاينة والطباعة والتحميل
                    </p>
                  ) : (
                    <p className="text-white/90 text-sm mt-2">
                      انقر على "إنشاء بطاقة" لإنشاء البطاقة التعليمية للطالب
                    </p>
                  )}
                </div>

                <div className="p-6">
                  {educationalCard ? (
                    <EducationalCard
                      card={educationalCard}
                      onPrint={handlePrintCard}
                      onDownload={handleDownloadCard}
                    />
                  ) : (
                    <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                      <GraduationCap className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600 font-semibold mb-2">لم يتم إنشاء البطاقة التعليمية بعد</p>
                      <p className="text-gray-500 text-sm mb-4">
                        قم بإنشاء البطاقة التعليمية لإرسالها للطالب
                      </p>
                      <button
                        onClick={() => setShowEducationalCardModal(true)}
                        className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors inline-flex items-center gap-2"
                      >
                        <Plus className="w-5 h-5" />
                        إنشاء بطاقة تعليمية
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Assigned Staff Card */}
            {application.assignedTo && (
              <div className="bg-gradient-to-br from-[#276073] to-[#1e4a5a] rounded-2xl shadow-lg p-6 text-white">
                <h3 className="text-sm font-medium text-blue-100 mb-3">الموظف المسؤول</h3>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-[#276073] font-bold text-xl shadow-lg">
                    {application.assignedTo.name ? application.assignedTo.name.charAt(0) : 'م'}
                  </div>
                  <div>
                    <p className="font-bold text-lg">{application.assignedTo.name}</p>
                    <p className="text-sm text-blue-100">{application.assignedTo.role}</p>
                  </div>
                </div>
                <div className="space-y-2 pt-3 border-t border-blue-300/30">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-blue-200" />
                    <span className="text-blue-100">{application.assignedTo.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 text-blue-200" />
                    <div>
                      <p className="text-blue-100">آخر إجراء: {application.assignedTo.lastAction}</p>
                      <p className="text-xs text-blue-200">{application.assignedTo.lastActionDate}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Activity Timeline */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-[#276073]" />
                  سجل الأنشطة
                </h2>
                <button
                  onClick={() => setIsAddingActivity(!isAddingActivity)}
                  className="text-sm px-3 py-1 bg-[#276073] text-white rounded-lg hover:bg-[#1e4a5a]"
                >
                  إضافة نشاط
                </button>
              </div>

              {isAddingActivity && (
                <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <select
                    value={newActivity.type}
                    onChange={(e) => setNewActivity({ ...newActivity, type: e.target.value })}
                    className="w-full mb-2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#276073] focus:border-transparent outline-none"
                  >
                    <option value="">اختر نوع النشاط</option>
                    <option value="status_change">تغيير الحالة</option>
                    <option value="document_upload">رفع مستند</option>
                    <option value="note">ملاحظة</option>
                    <option value="call">مكالمة هاتفية</option>
                    <option value="email">بريد إلكتروني</option>
                  </select>
                  <textarea
                    value={newActivity.message}
                    onChange={(e) => setNewActivity({ ...newActivity, message: e.target.value })}
                    placeholder="وصف النشاط..."
                    className="w-full mb-2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#276073] focus:border-transparent outline-none"
                    rows="3"
                  ></textarea>
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddActivity}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      حفظ
                    </button>
                    <button
                      onClick={() => {
                        setIsAddingActivity(false);
                        setNewActivity({ type: '', message: '' });
                      }}
                      className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {application.activities.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Activity className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                    <p>لا توجد أنشطة مسجلة بعد</p>
                  </div>
                ) : (
                  application.activities.map((activity, index) => {
                  const ActivityIconComponent = getActivityIcon(activity.type);
                  const isLast = index === application.activities.length - 1;

                  return (
                    <div key={activity.id} className="relative">
                      {!isLast && (
                        <div className="absolute right-5 top-12 bottom-0 w-0.5 bg-gray-200"></div>
                      )}

                      <div className="flex gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                          activity.status === 'completed' ? 'bg-green-100' : 'bg-blue-100'
                        }`}>
                          <ActivityIconComponent className={`w-5 h-5 ${
                            activity.status === 'completed' ? 'text-green-600' : 'text-blue-600'
                          }`} />
                        </div>

                        <div className="flex-1 bg-gray-50 rounded-lg p-3">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className="font-semibold text-gray-900 flex-1">{activity.title}</p>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${getActivityTypeBadgeColor(activity.type)}`}>
                              {getActivityTypeLabel(activity.type)}
                            </span>
                          </div>
                          {activity.description && (
                            <p className="text-sm text-gray-600 mb-2">{activity.description}</p>
                          )}
                          <div className="flex items-center justify-between text-xs text-gray-500 flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <User className="w-3 h-3" />
                              <span className="font-medium">{activity.user}</span>
                              {activity.userEmail && (
                                <span className="text-gray-400">({activity.userEmail})</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>{activity.timestamp}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Rejection Modal */}
      {showRejectionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" dir="rtl">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <AlertCircle className="w-6 h-6 text-red-600" />
                {newStatus === 'rejected' ? 'سبب رفض الطلب' : 'سبب إلغاء الطلب'}
              </h3>
              <button
                onClick={() => {
                  setShowRejectionModal(false);
                  setRejectionReason('');
                  setIsEditingStatus(false);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Warning Box */}
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-red-800">
                  <p className="font-semibold mb-1">تنبيه هام</p>
                  <p>سيتم إرسال السبب للعميل عبر البريد الإلكتروني. يرجى كتابة سبب واضح ومهني.</p>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-bold text-gray-700 mb-2">
                {newStatus === 'rejected' ? 'سبب رفض الطلب *' : 'سبب إلغاء الطلب *'}
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder={newStatus === 'rejected' ? 'مثال: تم رفض الطلب بسبب عدم اكتمال المستندات المطلوبة. يرجى إرفاق نسخة واضحة من جواز السفر وإعادة التقديم.' : 'مثال: تم إلغاء الطلب بناءً على طلب مقدم الخدمة.'}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none resize-none transition-all"
                rows="6"
                required
              ></textarea>
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-gray-500">
                  الحد الأدنى 20 حرف
                </p>
                <p className={`text-xs font-medium ${rejectionReason.length < 20 ? 'text-red-600' : 'text-green-600'}`}>
                  {rejectionReason.length} حرف
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleRejectionSubmit}
                disabled={rejectionReason.length < 20}
                className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all duration-200 ${
                  rejectionReason.length < 20
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-red-600 text-white hover:bg-red-700 shadow-lg hover:shadow-xl'
                }`}
              >
                {newStatus === 'rejected' ? 'تأكيد الرفض' : 'تأكيد الإلغاء'}
              </button>
              <button
                onClick={() => {
                  setShowRejectionModal(false);
                  setRejectionReason('');
                  setIsEditingStatus(false);
                }}
                className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold transition-colors"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shipping Modal */}
      <ShippingModal
        isOpen={showShippingModal}
        onClose={() => {
          setShowShippingModal(false);
          setIsEditingStatus(false);
        }}
        onSubmit={handleShippingSubmit}
        applicationId={id}
      />

      {/* Educational Card Modal */}
      <EducationalCardModal
        isOpen={showEducationalCardModal}
        onClose={() => setShowEducationalCardModal(false)}
        application={application}
        existingCard={educationalCard}
        onSave={handleEducationalCardSave}
      />

      {/* Image Viewer Modal */}
      {showImageViewer && currentImage && (
        <div className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-50 p-4">
          <div className="relative w-full h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 bg-black bg-opacity-50 backdrop-blur-sm">
              <div className="flex items-center gap-4">
                <h3 className="text-white font-semibold text-lg">{currentImage.name}</h3>
                <span className="text-gray-300 text-sm">{currentImage.size}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadImage}
                  className="p-3 bg-white bg-opacity-10 hover:bg-opacity-20 text-white rounded-lg transition-colors flex items-center gap-2"
                  title="تحميل"
                >
                  <Download className="w-5 h-5" />
                  <span className="hidden sm:inline">تحميل</span>
                </button>
                <button
                  onClick={handlePrintImage}
                  className="p-3 bg-white bg-opacity-10 hover:bg-opacity-20 text-white rounded-lg transition-colors flex items-center gap-2"
                  title="طباعة"
                >
                  <Printer className="w-5 h-5" />
                  <span className="hidden sm:inline">طباعة</span>
                </button>
                <button
                  onClick={() => {
                    setShowImageViewer(false);
                    setCurrentImage(null);
                  }}
                  className="p-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                  title="إغلاق"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Image Container */}
            <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
              <img
                src={currentImage.url}
                alt={currentImage.name}
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                style={{ maxHeight: 'calc(100vh - 120px)' }}
              />
            </div>

            {/* Footer Info */}
            <div className="p-4 bg-black bg-opacity-50 backdrop-blur-sm text-center">
              <p className="text-gray-300 text-sm">
                انقر خارج الصورة أو اضغط ESC للإغلاق
              </p>
            </div>
          </div>

          {/* Click outside to close */}
          <div
            className="absolute inset-0 -z-10"
            onClick={() => {
              setShowImageViewer(false);
              setCurrentImage(null);
            }}
          />
        </div>
      )}

      {/* Price Editor Modal */}
      <PriceEditor
        applicationId={application?.actualId || id}
        isOpen={showPriceEditor}
        onClose={() => setShowPriceEditor(false)}
        onSaved={handlePricingSaved}
      />

      {/* Invoice Creation Modal */}
      <InvoiceModal
        application={application}
        pricingSummary={pricingSummary}
        pricingItems={pricingItems}
        isOpen={showInvoiceModal}
        onClose={() => setShowInvoiceModal(false)}
        onInvoiceCreated={handleInvoiceCreated}
      />

      {/* Invoice PDF Viewer */}
      {showInvoicePDF && invoice && (
        <InvoicePDF
          invoice={invoice}
          onClose={() => setShowInvoicePDF(false)}
        />
      )}
    </div>
  );
};

export default ApplicationDetail;
